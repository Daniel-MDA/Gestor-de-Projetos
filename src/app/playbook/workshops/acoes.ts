"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Resultado padrão das ações (espelha o padrão {status} do projeto).
export type ResultadoAcao = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
};

// A autorização real é do RLS (escrita só para is_playbook_editor()); aqui só
// barramos sessão ausente e damos feedback amigável.

// ---------------------------------------------------------------------------
// Workshops (pai)
// ---------------------------------------------------------------------------

export async function adicionarWorkshop(): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  // Próxima ordem = maior ordem atual + 1.
  const { data: ult } = await supabase
    .from("playbook_workshops")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const proximaOrdem = (ult?.ordem ?? -1) + 1;

  const { error } = await supabase.from("playbook_workshops").insert({
    tema: "",
    organizador: "",
    local: "",
    data: "",
    obs: "",
    ordem: proximaOrdem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

type CampoWorkshop = "tema" | "organizador" | "local" | "data" | "obs";

export async function editarWorkshop(
  id: string,
  campo: CampoWorkshop,
  valor: string
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_workshops")
    .update({ [campo]: valor, atualizado_por: user.id })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerWorkshop(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  // Produtos têm ON DELETE CASCADE; basta remover o workshop.
  const { error } = await supabase
    .from("playbook_workshops")
    .delete()
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ---------------------------------------------------------------------------
// Produtos apresentados (filho)
// ---------------------------------------------------------------------------

export async function adicionarProduto(
  workshopId: string,
  texto: string
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const t = texto.trim();
  if (!t) return { status: "erro", mensagem: "Texto do produto vazio." };

  const { data: ult } = await supabase
    .from("playbook_workshop_produtos")
    .select("ordem")
    .eq("workshop_id", workshopId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const proximaOrdem = (ult?.ordem ?? -1) + 1;

  const { error } = await supabase.from("playbook_workshop_produtos").insert({
    workshop_id: workshopId,
    texto: t,
    ordem: proximaOrdem,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function editarProduto(
  id: string,
  texto: string
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const t = texto.trim();
  // Espelha o HTML: texto vazio remove o produto.
  if (!t) return removerProduto(id);

  const { error } = await supabase
    .from("playbook_workshop_produtos")
    .update({ texto: t })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

export async function removerProduto(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase
    .from("playbook_workshop_produtos")
    .delete()
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
