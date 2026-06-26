"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  DocSlot,
  LeadOrigem,
  CampoLogistica,
  CampoLeads,
  CampoPortal,
} from "./tipos";

// Resultado padrão das ações (espelha o padrão {status} das RPCs do projeto).
export type ResultadoAcao = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
};

// Helper: pega o supabase + o usuário, retornando null se não autenticado.
async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ── CHECKLIST: marcações + quantidades (PK composta evento_id,item_id) ───────

export async function toggleMarcacao(
  eventoId: string,
  itemId: string,
  marcado: boolean
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_checklist_marcacoes").upsert(
    {
      evento_id: eventoId,
      item_id: itemId,
      marcado,
      atualizado_por: user.id,
    },
    { onConflict: "evento_id,item_id" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function setQtd(
  eventoId: string,
  itemId: string,
  qtd: number | null
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const v =
    qtd == null || !Number.isFinite(qtd) || qtd < 0 ? null : Math.trunc(qtd);

  const { error } = await supabase.from("playbook_checklist_marcacoes").upsert(
    {
      evento_id: eventoId,
      item_id: itemId,
      qtd: v,
      atualizado_por: user.id,
    },
    { onConflict: "evento_id,item_id" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Marca/desmarca todos os itens (de uma lista) de uma só feira.
export async function marcarVarios(
  eventoId: string,
  itemIds: string[],
  marcado: boolean
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  if (itemIds.length === 0) return { status: "ok" };

  const linhas = itemIds.map((item_id) => ({
    evento_id: eventoId,
    item_id,
    marcado,
    atualizado_por: user.id,
  }));

  const { error } = await supabase
    .from("playbook_checklist_marcacoes")
    .upsert(linhas, { onConflict: "evento_id,item_id" });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── LOGÍSTICA (1 por feira) — garante o parent via upsert por evento_id ──────

// Garante a linha de logística da feira e devolve seu id.
async function garantirLogistica(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventoId: string,
  userId: string
): Promise<{ id?: string; erro?: string }> {
  const existente = await supabase
    .from("playbook_logistica")
    .select("id")
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (existente.data?.id) return { id: existente.data.id };

  const ins = await supabase
    .from("playbook_logistica")
    .upsert(
      { evento_id: eventoId, atualizado_por: userId },
      { onConflict: "evento_id" }
    )
    .select("id")
    .single();
  if (ins.error) return { erro: ins.error.message };
  return { id: ins.data.id };
}

export async function salvarLogisticaCampo(
  eventoId: string,
  campo: CampoLogistica,
  valor: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_logistica").upsert(
    {
      evento_id: eventoId,
      [campo]: valor,
      atualizado_por: user.id,
    },
    { onConflict: "evento_id" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── Colaboradores (array text[] na linha de logística) ───────────────────────

export async function addColaborador(
  eventoId: string,
  nome: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome." };

  const { id, erro } = await garantirLogistica(supabase, eventoId, user.id);
  if (erro || !id) return { status: "erro", mensagem: erro };

  const atual = await supabase
    .from("playbook_logistica")
    .select("colaboradores")
    .eq("id", id)
    .single();
  if (atual.error) return { status: "erro", mensagem: atual.error.message };

  const lista = Array.isArray(atual.data.colaboradores)
    ? (atual.data.colaboradores as string[])
    : [];
  lista.push(limpo);

  const { error } = await supabase
    .from("playbook_logistica")
    .update({ colaboradores: lista, atualizado_por: user.id })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerColaborador(
  eventoId: string,
  indice: number
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const atual = await supabase
    .from("playbook_logistica")
    .select("id, colaboradores")
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (atual.error) return { status: "erro", mensagem: atual.error.message };
  if (!atual.data) return { status: "ok" };

  const lista = Array.isArray(atual.data.colaboradores)
    ? (atual.data.colaboradores as string[])
    : [];
  if (indice < 0 || indice >= lista.length) return { status: "ok" };
  lista.splice(indice, 1);

  const { error } = await supabase
    .from("playbook_logistica")
    .update({ colaboradores: lista, atualizado_por: user.id })
    .eq("id", atual.data.id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── Custos (filhos da logística) ─────────────────────────────────────────────

export async function addCusto(
  eventoId: string,
  descricao: string,
  valor: number,
  ordem: number
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { id, erro } = await garantirLogistica(supabase, eventoId, user.id);
  if (erro || !id) return { status: "erro", mensagem: erro };

  const v = Number.isFinite(valor) && valor > 0 ? valor : 0;
  const { error } = await supabase.from("playbook_custos").insert({
    logistica_id: id,
    descricao: descricao.trim(),
    valor: v,
    ordem,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function editarCusto(
  custoId: string,
  campos: { descricao?: string; valor?: number }
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const patch: { descricao?: string; valor?: number } = {};
  if (campos.descricao !== undefined) patch.descricao = campos.descricao.trim();
  if (campos.valor !== undefined)
    patch.valor =
      Number.isFinite(campos.valor) && campos.valor > 0 ? campos.valor : 0;

  const { error } = await supabase
    .from("playbook_custos")
    .update(patch)
    .eq("id", custoId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerCusto(custoId: string): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_custos")
    .delete()
    .eq("id", custoId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── Documentos da logística (link) — upsert do doc por (logistica_id, slot) ──

// Salva o link de um doc fixo (slot != 'outro'). Garante a logística antes e,
// se já existir um doc daquele slot, atualiza; senão cria.
export async function salvarDocLink(
  eventoId: string,
  slot: DocSlot,
  link: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { id: logId, erro } = await garantirLogistica(
    supabase,
    eventoId,
    user.id
  );
  if (erro || !logId) return { status: "erro", mensagem: erro };

  const existente = await supabase
    .from("playbook_logistica_docs")
    .select("id")
    .eq("logistica_id", logId)
    .eq("slot", slot)
    .maybeSingle();
  if (existente.error)
    return { status: "erro", mensagem: existente.error.message };

  const valor = link.trim() || null;
  if (existente.data?.id) {
    const { error } = await supabase
      .from("playbook_logistica_docs")
      .update({ link: valor, atualizado_por: user.id })
      .eq("id", existente.data.id);
    if (error) return { status: "erro", mensagem: error.message };
  } else {
    const { error } = await supabase.from("playbook_logistica_docs").insert({
      logistica_id: logId,
      slot,
      link: valor,
      atualizado_por: user.id,
    });
    if (error) return { status: "erro", mensagem: error.message };
  }

  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── LEADS (1 por feira) — links de planilha ──────────────────────────────────

// Garante a linha de leads da feira e devolve seu id.
async function garantirLeads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventoId: string,
  userId: string
): Promise<{ id?: string; erro?: string }> {
  const existente = await supabase
    .from("playbook_leads")
    .select("id")
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (existente.data?.id) return { id: existente.data.id };

  const ins = await supabase
    .from("playbook_leads")
    .upsert(
      { evento_id: eventoId, atualizado_por: userId },
      { onConflict: "evento_id" }
    )
    .select("id")
    .single();
  if (ins.error) return { erro: ins.error.message };
  return { id: ins.data.id };
}

export async function salvarLeadsCampo(
  eventoId: string,
  campo: CampoLeads,
  valor: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_leads").upsert(
    {
      evento_id: eventoId,
      [campo]: valor.trim() || null,
      atualizado_por: user.id,
    },
    { onConflict: "evento_id" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── Leads manuais (filhos — PII / LGPD) ──────────────────────────────────────

export async function addLeadManual(
  eventoId: string,
  ordem: number
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { id, erro } = await garantirLeads(supabase, eventoId, user.id);
  if (erro || !id) return { status: "erro", mensagem: erro };

  const { error } = await supabase.from("playbook_leads_manuais").insert({
    leads_id: id,
    origem: "Cartão de visita",
    ordem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function editarLeadManual(
  leadId: string,
  campo: "nome" | "empresa" | "cargo" | "email" | "telefone" | "obs" | "origem",
  valor: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  let patch: Record<string, string | LeadOrigem | null>;
  if (campo === "origem") {
    patch = { origem: valor as LeadOrigem };
  } else {
    patch = { [campo]: valor.trim() || null };
  }
  patch.atualizado_por = user.id;

  const { error } = await supabase
    .from("playbook_leads_manuais")
    .update(patch)
    .eq("id", leadId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerLeadManual(leadId: string): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_leads_manuais")
    .delete()
    .eq("id", leadId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── PORTAL (1 por feira) — credenciais ───────────────────────────────────────

export async function salvarPortalCampo(
  eventoId: string,
  campo: CampoPortal,
  valor: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_portais").upsert(
    {
      evento_id: eventoId,
      [campo]: valor.trim() || null,
      atualizado_por: user.id,
    },
    { onConflict: "evento_id" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
