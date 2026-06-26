"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Resultado padrão das ações (espelha o padrão {status} das RPCs do projeto).
export type ResultadoAcao = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
};

// ── Brindes (pai) ──────────────────────────────────────────────────────────

// Adiciona um novo brinde. A ordem é o tamanho atual da lista.
export async function adicionarBrinde(
  nome: string,
  estoqueInicial: number | null,
  ordem: number
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe um nome para o brinde." };

  const { error } = await supabase.from("playbook_brindes").insert({
    nome: limpo,
    estoque_inicial: estoqueInicial,
    ordem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Edita nome e/ou estoque inicial de um brinde.
export async function editarBrinde(
  id: string,
  campos: { nome?: string; estoque_inicial?: number | null }
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const patch: { nome?: string; estoque_inicial?: number | null; atualizado_por: string } = {
    atualizado_por: user.id,
  };
  if (campos.nome !== undefined) {
    const limpo = campos.nome.trim();
    if (!limpo) return { status: "erro", mensagem: "O nome não pode ficar vazio." };
    patch.nome = limpo;
  }
  if (campos.estoque_inicial !== undefined) patch.estoque_inicial = campos.estoque_inicial;

  const { error } = await supabase.from("playbook_brindes").update(patch).eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Remove um brinde (o cascade do banco apaga as saídas associadas).
export async function removerBrinde(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_brindes").delete().eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── Saídas / usos (filho) ──────────────────────────────────────────────────

// Adiciona uma saída a um brinde.
export async function adicionarUso(
  brindeId: string,
  motivo: string,
  qtd: number,
  ordem: number
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_brinde_usos").insert({
    brinde_id: brindeId,
    motivo: motivo.trim() || null,
    qtd: qtd < 0 ? 0 : qtd,
    ordem,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Edita o motivo e/ou a quantidade de uma saída.
export async function editarUso(
  id: string,
  campos: { motivo?: string; qtd?: number }
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const patch: { motivo?: string | null; qtd?: number } = {};
  if (campos.motivo !== undefined) patch.motivo = campos.motivo.trim() || null;
  if (campos.qtd !== undefined) patch.qtd = campos.qtd < 0 ? 0 : campos.qtd;

  const { error } = await supabase.from("playbook_brinde_usos").update(patch).eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Remove uma saída.
export async function removerUso(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_brinde_usos").delete().eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
