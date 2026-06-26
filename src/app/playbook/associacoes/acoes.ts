"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Resultado padrão das ações (espelha o padrão {status} do projeto).
// A autorização real é do RLS (escrita só is_playbook_editor()); aqui só
// barramos sessão ausente e damos feedback amigável.
export type ResultadoAcao = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
};

// ---------------------------------------------------------------------------
// ASSOCIAÇÕES (parent)
// ---------------------------------------------------------------------------

export async function adicionarAssociacao(
  nome: string,
  ordem: number
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome da associação." };

  const { error } = await supabase
    .from("playbook_associacoes")
    .insert({ nome: limpo, desconto: null, ordem, atualizado_por: user.id });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerAssociacao(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  // Benefícios filhos caem por ON DELETE CASCADE.
  const { error } = await supabase
    .from("playbook_associacoes")
    .delete()
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function editarNomeAssociacao(
  id: string,
  nome: string
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const limpo = nome.trim();
  if (!limpo) return { status: "erro", mensagem: "O nome não pode ficar vazio." };

  const { error } = await supabase
    .from("playbook_associacoes")
    .update({ nome: limpo, atualizado_por: user.id })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// desconto: null limpa o campo; senão grava entre 0 e 100.
export async function editarDescontoAssociacao(
  id: string,
  desconto: number | null
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  let valor: number | null = desconto;
  if (valor !== null) {
    if (Number.isNaN(valor) || valor < 0) valor = 0;
    else if (valor > 100) valor = 100;
  }

  const { error } = await supabase
    .from("playbook_associacoes")
    .update({ desconto: valor, atualizado_por: user.id })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ---------------------------------------------------------------------------
// BENEFÍCIOS (filhos)
// ---------------------------------------------------------------------------

export async function adicionarBeneficio(
  associacaoId: string,
  texto: string,
  ordem: number
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const limpo = texto.trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o texto do benefício." };

  const { error } = await supabase
    .from("playbook_associacao_beneficios")
    .insert({ associacao_id: associacaoId, texto: limpo, ordem });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Espelha o HTML: texto vazio remove o benefício; senão atualiza.
export async function editarBeneficio(
  id: string,
  texto: string
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const limpo = texto.trim();
  if (!limpo) {
    const { error } = await supabase
      .from("playbook_associacao_beneficios")
      .delete()
      .eq("id", id);
    if (error) return { status: "erro", mensagem: error.message };
    revalidatePath("/playbook");
    return { status: "ok" };
  }

  const { error } = await supabase
    .from("playbook_associacao_beneficios")
    .update({ texto: limpo })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerBeneficio(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_associacao_beneficios")
    .delete()
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
