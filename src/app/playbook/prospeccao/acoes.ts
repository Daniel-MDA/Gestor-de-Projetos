"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Participacao } from "./dados";

// Resultado padrão das ações (espelha o padrão {status} do projeto).
export type ResultadoAcao = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
};

// ---------------------------------------------------------------------------
// SETORES
// ---------------------------------------------------------------------------

export async function adicionarSetor(nome: string): Promise<ResultadoAcao> {
  const limpo = (nome || "").trim();
  if (!limpo) return { status: "erro", mensagem: "Informe o nome do setor." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  // Próxima ordem (ao final da lista).
  const { data: ult } = await supabase
    .from("playbook_prospeccao_setores")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = (ult?.ordem ?? -1) + 1;

  const { error } = await supabase
    .from("playbook_prospeccao_setores")
    .insert({ nome: limpo, ordem, atualizado_por: user.id });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function editarSetor(
  id: string,
  nome: string
): Promise<ResultadoAcao> {
  const limpo = (nome || "").trim();
  if (!limpo) return { status: "erro", mensagem: "O nome não pode ficar vazio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_prospeccao_setores")
    .update({ nome: limpo, atualizado_por: user.id })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerSetor(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  // Eventos têm FK on delete cascade — basta remover o setor.
  const { error } = await supabase
    .from("playbook_prospeccao_setores")
    .delete()
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ---------------------------------------------------------------------------
// EVENTOS (filhos de um setor)
// ---------------------------------------------------------------------------

export async function adicionarEvento(
  setorId: string,
  nome: string,
  link: string,
  participacao: Participacao
): Promise<ResultadoAcao> {
  const nomeLimpo = (nome || "").trim();
  if (!nomeLimpo)
    return { status: "erro", mensagem: "Informe o nome do evento." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { data: ult } = await supabase
    .from("playbook_prospeccao_eventos")
    .select("ordem")
    .eq("setor_id", setorId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = (ult?.ordem ?? -1) + 1;

  const { error } = await supabase.from("playbook_prospeccao_eventos").insert({
    setor_id: setorId,
    nome: nomeLimpo,
    link: (link || "").trim() || null,
    participacao,
    obs: "",
    ordem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function editarEvento(
  id: string,
  campos: { nome?: string; link?: string; participacao?: Participacao; obs?: string }
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const patch: {
    nome?: string;
    link?: string | null;
    participacao?: Participacao;
    obs?: string;
    atualizado_por: string;
  } = { atualizado_por: user.id };

  if (campos.nome !== undefined) {
    const n = campos.nome.trim();
    if (!n) return { status: "erro", mensagem: "O nome não pode ficar vazio." };
    patch.nome = n;
  }
  if (campos.link !== undefined) patch.link = campos.link.trim() || null;
  if (campos.participacao !== undefined) patch.participacao = campos.participacao;
  if (campos.obs !== undefined) patch.obs = campos.obs.trim();

  const { error } = await supabase
    .from("playbook_prospeccao_eventos")
    .update(patch)
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerEvento(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_prospeccao_eventos")
    .delete()
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
