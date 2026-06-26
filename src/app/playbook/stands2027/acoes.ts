"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { StandStatus, StandDocSlot } from "./tipos";

// Resultado padrão das ações (espelha o padrão {status} das RPCs do projeto).
export type ResultadoAcao = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
};

// Campos editáveis de um stand.
export type CamposStand = {
  nome?: string | null;
  local?: string | null;
  data?: string | null;
  data_limite?: string | null;
  status?: StandStatus;
  valor?: number | null;
  obs?: string | null;
};

// ── Stands (pai) ─────────────────────────────────────────────────────────────

// Adiciona um novo stand/evento. A ordem é o tamanho atual da lista.
export async function adicionarStand(ordem: number): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_stands2027").insert({
    status: "A avaliar",
    ordem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Edita um ou mais campos de um stand.
export async function editarStand(
  id: string,
  campos: CamposStand
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const patch: Record<string, unknown> = { atualizado_por: user.id };
  if (campos.nome !== undefined) patch.nome = campos.nome?.trim() || null;
  if (campos.local !== undefined) patch.local = campos.local?.trim() || null;
  if (campos.data !== undefined) patch.data = campos.data?.trim() || null;
  if (campos.data_limite !== undefined)
    patch.data_limite = campos.data_limite?.trim() || null;
  if (campos.status !== undefined) patch.status = campos.status;
  if (campos.valor !== undefined)
    patch.valor =
      campos.valor == null || campos.valor < 0 ? null : campos.valor;
  if (campos.obs !== undefined) patch.obs = campos.obs?.trim() || null;

  const { error } = await supabase
    .from("playbook_stands2027")
    .update(patch)
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Remove um stand (o cascade do banco apaga os documentos associados).
export async function removerStand(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_stands2027")
    .delete()
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── Documentos (filho) ───────────────────────────────────────────────────────

// Define (upsert) ou limpa o link de um documento de um stand, por (stand_id, slot).
// Na v1 o documento é apenas um link (URL); não há upload binário.
export async function salvarStandDocLink(
  standId: string,
  slot: StandDocSlot,
  link: string
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const limpo = link.trim();

  // Sem link -> remove a linha do documento (se existir).
  if (!limpo) {
    const { error } = await supabase
      .from("playbook_stand_docs")
      .delete()
      .eq("stand_id", standId)
      .eq("slot", slot);
    if (error) return { status: "erro", mensagem: error.message };
    revalidatePath("/playbook");
    return { status: "ok" };
  }

  // Upsert pela restrição unique (stand_id, slot).
  const { error } = await supabase.from("playbook_stand_docs").upsert(
    {
      stand_id: standId,
      slot,
      link: limpo,
    },
    { onConflict: "stand_id,slot" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Define (upsert) o arquivo enviado de um documento de stand, por (stand_id, slot).
// Grava storage_path + nome_arquivo (o binário fica no Storage; aqui só o caminho).
// OBS: playbook_stand_docs NÃO tem coluna atualizado_por — não enviar.
export async function salvarStandDocArquivo(
  standId: string,
  slot: StandDocSlot,
  storagePath: string,
  nomeArquivo: string
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_stand_docs").upsert(
    {
      stand_id: standId,
      slot,
      storage_path: storagePath,
      nome_arquivo: nomeArquivo,
    },
    { onConflict: "stand_id,slot" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Limpa o arquivo enviado de um documento de stand (storage_path + nome_arquivo),
// preservando o eventual 'link'. Faz upsert para não apagar a linha (e o link).
// OBS: playbook_stand_docs NÃO tem coluna atualizado_por — não enviar.
export async function removerStandDocArquivo(
  standId: string,
  slot: StandDocSlot
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_stand_docs").upsert(
    {
      stand_id: standId,
      slot,
      storage_path: null,
      nome_arquivo: null,
    },
    { onConflict: "stand_id,slot" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
