import { createClient } from "@/lib/supabase/server";
import type {
  Dados,
  Evento,
  Setor,
  Categoria,
  Item,
  Marcacao,
  Logistica,
  LogisticaDoc,
  Custo,
  Leads,
  LeadManual,
  Portal,
} from "./tipos";

// Re-exporta os tipos para quem importa de "./dados".
export type {
  DocSlot,
  LeadOrigem,
  Aba,
  Item,
  Categoria,
  Setor,
  Evento,
  Marcacao,
  LogisticaDoc,
  Custo,
  Logistica,
  LeadManual,
  Leads,
  Portal,
  Dados,
  CampoLogistica,
  CampoLeads,
  CampoPortal,
} from "./tipos";

// ── Linhas cruas do supabase ─────────────────────────────────────────────────
type MarcacaoRow = {
  evento_id: string;
  item_id: string;
  marcado: boolean;
  qtd: number | null;
};
type LogisticaRow = {
  id: string;
  evento_id: string;
  hotel: string | null;
  transporte: string | null;
  obs: string | null;
  colaboradores: string[] | null;
};
type LeadsRow = {
  id: string;
  evento_id: string;
  planilha_nome: string | null;
  planilha_storage_path: string | null;
  planilha_link: string | null;
  manual_planilha_nome: string | null;
  manual_planilha_storage_path: string | null;
  manual_planilha_link: string | null;
};

// Busca tudo da seção e monta o pacote indexado por evento_id. Leitura pública
// via RLS — para um visitante ANÔNIMO, portais e leads_manuais voltam vazios
// (bloqueados por RLS), o que o componente trata mostrando "Entre para ver…".
export async function carregar(): Promise<Dados> {
  const supabase = await createClient();

  const [
    eventosRes,
    setoresRes,
    categoriasRes,
    itensRes,
    marcacoesRes,
    logisticaRes,
    docsRes,
    custosRes,
    leadsRes,
    leadsManuaisRes,
    portaisRes,
  ] = await Promise.all([
    supabase
      .from("playbook_eventos")
      .select("id, nome, local, data, status, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_setores")
      .select("id, nome, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_categorias")
      .select("id, slug, nome, setor_id, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_itens")
      .select("id, categoria_id, slug, nome, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_checklist_marcacoes")
      .select("evento_id, item_id, marcado, qtd"),
    supabase
      .from("playbook_logistica")
      .select("id, evento_id, hotel, transporte, obs, colaboradores"),
    supabase
      .from("playbook_logistica_docs")
      .select("id, logistica_id, slot, titulo, nome_arquivo, storage_path, link, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_custos")
      .select("id, logistica_id, descricao, valor, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_leads")
      .select(
        "id, evento_id, planilha_nome, planilha_storage_path, planilha_link, manual_planilha_nome, manual_planilha_storage_path, manual_planilha_link"
      ),
    // PII — só vem para usuário logado (RLS); anon recebe [].
    supabase
      .from("playbook_leads_manuais")
      .select("id, leads_id, nome, empresa, cargo, email, telefone, origem, obs, ordem")
      .order("ordem", { ascending: true }),
    // Credenciais — só vem para usuário logado (RLS); anon recebe [].
    supabase.from("playbook_portais").select("id, evento_id, link, login, senha"),
  ]);

  const erro =
    eventosRes.error ||
    setoresRes.error ||
    categoriasRes.error ||
    itensRes.error ||
    marcacoesRes.error ||
    logisticaRes.error ||
    docsRes.error ||
    custosRes.error ||
    leadsRes.error;
  // leadsManuaisRes / portaisRes podem ter erro de permissão para anon — ignorado.
  if (erro)
    throw new Error("Falha ao carregar a página da feira: " + erro.message);

  const eventos = (eventosRes.data ?? []) as Evento[];
  const setores = (setoresRes.data ?? []) as Setor[];
  const categoriasRaw = (categoriasRes.data ?? []) as Omit<Categoria, "itens">[];
  const itens = (itensRes.data ?? []) as Item[];

  // Monta a árvore: cada categoria com seus itens (ordenados).
  const categorias: Categoria[] = categoriasRaw.map((c) => ({
    ...c,
    itens: itens
      .filter((i) => i.categoria_id === c.id)
      .sort((a, b) => a.ordem - b.ordem),
  }));

  // Marcações: [eventoId][itemId] = { marcado, qtd }
  const marcacoes: Record<string, Record<string, Marcacao>> = {};
  for (const r of (marcacoesRes.data ?? []) as MarcacaoRow[]) {
    if (!marcacoes[r.evento_id]) marcacoes[r.evento_id] = {};
    marcacoes[r.evento_id][r.item_id] = { marcado: r.marcado, qtd: r.qtd };
  }

  // Logística: indexada por evento_id, com docs e custos por logistica_id.
  const docs = (docsRes.data ?? []) as (LogisticaDoc & { logistica_id: string })[];
  const custos = (custosRes.data ?? []) as (Custo & { logistica_id: string })[];
  const logistica: Record<string, Logistica> = {};
  for (const r of (logisticaRes.data ?? []) as LogisticaRow[]) {
    logistica[r.evento_id] = {
      id: r.id,
      evento_id: r.evento_id,
      hotel: r.hotel,
      transporte: r.transporte,
      obs: r.obs,
      colaboradores: Array.isArray(r.colaboradores) ? r.colaboradores : [],
      docs: docs
        .filter((d) => d.logistica_id === r.id)
        .map((d) => ({
          id: d.id,
          slot: d.slot,
          titulo: d.titulo,
          nome_arquivo: d.nome_arquivo,
          storage_path: d.storage_path,
          link: d.link,
          ordem: d.ordem,
        })),
      custos: custos
        .filter((c) => c.logistica_id === r.id)
        .map((c) => ({
          id: c.id,
          descricao: c.descricao,
          valor: Number(c.valor),
          ordem: c.ordem,
        })),
    };
  }

  // Leads: indexado por evento_id, com manuais por leads_id.
  const manuais = (leadsManuaisRes.data ?? []) as (LeadManual & {
    leads_id: string;
  })[];
  const leads: Record<string, Leads> = {};
  for (const r of (leadsRes.data ?? []) as LeadsRow[]) {
    leads[r.evento_id] = {
      id: r.id,
      evento_id: r.evento_id,
      planilha_nome: r.planilha_nome,
      planilha_storage_path: r.planilha_storage_path,
      planilha_link: r.planilha_link,
      manual_planilha_nome: r.manual_planilha_nome,
      manual_planilha_storage_path: r.manual_planilha_storage_path,
      manual_planilha_link: r.manual_planilha_link,
      manuais: manuais
        .filter((m) => m.leads_id === r.id)
        .map((m) => ({
          id: m.id,
          nome: m.nome,
          empresa: m.empresa,
          cargo: m.cargo,
          email: m.email,
          telefone: m.telefone,
          origem: m.origem,
          obs: m.obs,
          ordem: m.ordem,
        })),
    };
  }

  // Portais: indexado por evento_id.
  const portais: Record<string, Portal> = {};
  for (const r of (portaisRes.data ?? []) as Portal[]) {
    portais[r.evento_id] = r;
  }

  return { eventos, setores, categorias, marcacoes, logistica, leads, portais };
}
