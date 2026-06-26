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

// ── ÁRVORE DO CHECKLIST — setores / categorias / itens (edição, só-editor) ───
// As 3 tabelas têm coluna atualizado_por (ver 10_playbook.sql). A árvore é
// global (compartilhada por todas as feiras). RLS garante a autorização real.

// SETORES ────────────────────────────────────────────────────────────────────

export async function addSetor(nome: string): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome do setor." };

  const max = await supabase
    .from("playbook_setores")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (max.error) return { status: "erro", mensagem: max.error.message };
  const proximaOrdem = ((max.data?.ordem as number | undefined) ?? -1) + 1;

  const { error } = await supabase.from("playbook_setores").insert({
    nome: limpo,
    ordem: proximaOrdem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function renomearSetor(
  setorId: string,
  nome: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome do setor." };

  const { error } = await supabase
    .from("playbook_setores")
    .update({ nome: limpo, atualizado_por: user.id })
    .eq("id", setorId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Remove o setor. As categorias dele NÃO são apagadas: a FK setor_id é
// ON DELETE SET NULL (10_playbook.sql), então elas voltam a ficar "sem setor"
// e aparecem como categorias soltas. Nada de conteúdo é perdido.
export async function removerSetor(setorId: string): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_setores")
    .delete()
    .eq("id", setorId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// CATEGORIAS ─────────────────────────────────────────────────────────────────

export async function addCategoria(
  nome: string,
  setorId: string | null
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome da divisão." };

  const max = await supabase
    .from("playbook_categorias")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (max.error) return { status: "erro", mensagem: max.error.message };
  const proximaOrdem = ((max.data?.ordem as number | undefined) ?? -1) + 1;

  const { error } = await supabase.from("playbook_categorias").insert({
    nome: limpo,
    setor_id: setorId,
    ordem: proximaOrdem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function renomearCategoria(
  categoriaId: string,
  nome: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome da divisão." };

  const { error } = await supabase
    .from("playbook_categorias")
    .update({ nome: limpo, atualizado_por: user.id })
    .eq("id", categoriaId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Remove a categoria e, em cascata (FK ON DELETE CASCADE), seus itens — e as
// marcações desses itens (que também referenciam item_id em cascata).
export async function removerCategoria(
  categoriaId: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_categorias")
    .delete()
    .eq("id", categoriaId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ITENS ──────────────────────────────────────────────────────────────────────

export async function addItem(
  categoriaId: string,
  nome: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome do item." };

  const max = await supabase
    .from("playbook_itens")
    .select("ordem")
    .eq("categoria_id", categoriaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (max.error) return { status: "erro", mensagem: max.error.message };
  const proximaOrdem = ((max.data?.ordem as number | undefined) ?? -1) + 1;

  const { error } = await supabase.from("playbook_itens").insert({
    categoria_id: categoriaId,
    nome: limpo,
    ordem: proximaOrdem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function renomearItem(
  itemId: string,
  nome: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };
  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome do item." };

  const { error } = await supabase
    .from("playbook_itens")
    .update({ nome: limpo, atualizado_por: user.id })
    .eq("id", itemId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Remove o item — as marcações dele (PK evento_id,item_id) caem em cascata.
export async function removerItem(itemId: string): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_itens")
    .delete()
    .eq("id", itemId);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── ANEXOS — upload real de arquivos (Storage path + nome na tabela) ─────────
// As Server Actions só gravam o caminho/nome devolvido pelo UploadCampo; o
// upload binário em si é feito no cliente (UploadCampo) direto no Storage.

// LOGÍSTICA: anexo de um doc fixo (slot). Garante a logística e faz upsert do
// doc por (logistica_id, slot), preservando o link existente. nome_arquivo +
// storage_path ficam na tabela playbook_logistica_docs.
export async function salvarDocAnexo(
  eventoId: string,
  slot: DocSlot,
  storagePath: string,
  nomeArquivo: string
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

  if (existente.data?.id) {
    const { error } = await supabase
      .from("playbook_logistica_docs")
      .update({
        storage_path: storagePath,
        nome_arquivo: nomeArquivo,
        atualizado_por: user.id,
      })
      .eq("id", existente.data.id);
    if (error) return { status: "erro", mensagem: error.message };
  } else {
    const { error } = await supabase.from("playbook_logistica_docs").insert({
      logistica_id: logId,
      slot,
      storage_path: storagePath,
      nome_arquivo: nomeArquivo,
      atualizado_por: user.id,
    });
    if (error) return { status: "erro", mensagem: error.message };
  }

  revalidatePath("/playbook");
  return { status: "ok" };
}

// LOGÍSTICA: remove o anexo do doc (limpa storage_path + nome_arquivo),
// mantendo a linha e o eventual link.
export async function removerDocAnexo(
  eventoId: string,
  slot: DocSlot
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const existente = await supabase
    .from("playbook_logistica")
    .select("id")
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (existente.error)
    return { status: "erro", mensagem: existente.error.message };
  if (!existente.data?.id) return { status: "ok" };

  const { error } = await supabase
    .from("playbook_logistica_docs")
    .update({
      storage_path: null,
      nome_arquivo: null,
      atualizado_por: user.id,
    })
    .eq("logistica_id", existente.data.id)
    .eq("slot", slot);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// LEADS: anexo da planilha do coletor. Garante a linha de leads (upsert por
// evento_id) e grava planilha_storage_path + planilha_nome.
export async function salvarLeadsPlanilhaAnexo(
  eventoId: string,
  storagePath: string,
  nomeArquivo: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_leads").upsert(
    {
      evento_id: eventoId,
      planilha_storage_path: storagePath,
      planilha_nome: nomeArquivo,
      atualizado_por: user.id,
    },
    { onConflict: "evento_id" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerLeadsPlanilhaAnexo(
  eventoId: string
): Promise<ResultadoAcao> {
  const { supabase, user } = await ctx();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_leads")
    .update({
      planilha_storage_path: null,
      planilha_nome: null,
      atualizado_por: user.id,
    })
    .eq("evento_id", eventoId);

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
