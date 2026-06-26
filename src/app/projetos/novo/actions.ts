"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

type ResultadoCriarProjeto =
  | { ok: true; projetoId: string }
  | { ok: false; erro: string };

export async function criarProjetoAction(
  nome: string,
  descricao: string | null
): Promise<ResultadoCriarProjeto> {
  const supabase = await createClient();

  // Garante sessão antes de chamar a RPC
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, erro: "Sessão expirada. Faça login novamente." };
  }

  // Chama a função do banco
  const { data, error } = await supabase.rpc("criar_projeto", {
    p_nome: nome,
    p_descricao: descricao,
  });

  if (error) {
    return { ok: false, erro: "Erro ao criar projeto: " + error.message };
  }

  const resultado = data as
    | { status: "ok"; projeto_id: string }
    | { status: "erro"; mensagem: string };

  if (resultado.status === "erro") {
    return { ok: false, erro: resultado.mensagem };
  }

  // Salva como projeto atual (cookie)
  const cookieStore = await cookies();
  cookieStore.set("projeto_atual", resultado.projeto_id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  // Invalida cache do dashboard
  revalidatePath("/tarefas");

  return { ok: true, projetoId: resultado.projeto_id };
}
