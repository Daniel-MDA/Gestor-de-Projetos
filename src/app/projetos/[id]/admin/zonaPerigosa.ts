"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { BUCKET_ANEXOS } from "@/lib/anexos";

type Resultado = { ok: true } | { ok: false; erro: string };

// =============================================================================
// arquivarProjetoAction
// =============================================================================
export async function arquivarProjetoAction(
  projetoId: string
): Promise<Resultado> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  const { data, error } = await supabase.rpc("arquivar_projeto", {
    p_projeto_id: projetoId,
  });

  if (error) return { ok: false, erro: error.message };

  const r = data as { status: string };
  if (r.status === "nao_autorizado")
    return { ok: false, erro: "Você precisa ser admin para arquivar." };
  if (r.status === "projeto_nao_encontrado")
    return { ok: false, erro: "Projeto não encontrado." };
  if (r.status !== "ok") return { ok: false, erro: "Erro: " + r.status };

  // Limpa o cookie se o projeto arquivado era o ativo
  const cookieStore = await cookies();
  if (cookieStore.get("projeto_atual")?.value === projetoId) {
    cookieStore.delete("projeto_atual");
  }

  revalidatePath("/dashboard");
  return { ok: true };
}


// =============================================================================
// excluirProjetoAction
// =============================================================================
// Faz em três etapas:
//   1. Pede ao banco os paths dos anexos (RPC listar_anexos_projeto)
//   2. Remove esses arquivos do Storage (em lote)
//   3. Chama RPC excluir_projeto (que faz DELETE em cascata)
//
// Se a remoção do Storage falhar (rede etc), seguimos com o DELETE no banco.
// O resultado é um Storage com lixo, mas o projeto está realmente apagado.
// =============================================================================
export async function excluirProjetoAction(
  projetoId: string,
  nomeConfirmacao: string
): Promise<Resultado> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  // 1. Lista anexos
  const { data: listaData, error: listaErr } = await supabase.rpc(
    "listar_anexos_projeto",
    { p_projeto_id: projetoId }
  );

  if (listaErr) return { ok: false, erro: listaErr.message };
  const lista = listaData as
    | { status: "ok"; paths: string[] }
    | { status: "nao_autorizado" };

  if (lista.status === "nao_autorizado") {
    return { ok: false, erro: "Você precisa ser admin para excluir." };
  }

  // 2. Remove arquivos do Storage (best-effort)
  if (lista.paths.length > 0) {
    // O remove() do Supabase aceita array de paths; até ~100 por chamada
    // costuma funcionar. Para volumes maiores, paginamos.
    const lote = 100;
    for (let i = 0; i < lista.paths.length; i += lote) {
      const slice = lista.paths.slice(i, i + lote);
      const { error: rmErr } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .remove(slice);
      if (rmErr) {
        // Loga, mas segue para o DELETE.
        console.error("Falha ao remover arquivos do Storage:", rmErr);
      }
    }
  }

  // 3. Exclui o projeto
  const { data, error } = await supabase.rpc("excluir_projeto", {
    p_projeto_id: projetoId,
    p_nome_confirmacao: nomeConfirmacao,
  });

  if (error) return { ok: false, erro: error.message };

  const r = data as { status: string };
  if (r.status === "nao_autorizado")
    return { ok: false, erro: "Você precisa ser admin para excluir." };
  if (r.status === "projeto_nao_encontrado")
    return { ok: false, erro: "Projeto não encontrado." };
  if (r.status === "nome_nao_confere")
    return {
      ok: false,
      erro: "O nome digitado não confere com o nome do projeto.",
    };
  if (r.status !== "ok") return { ok: false, erro: "Erro: " + r.status };

  // Limpa cookie
  const cookieStore = await cookies();
  if (cookieStore.get("projeto_atual")?.value === projetoId) {
    cookieStore.delete("projeto_atual");
  }

  revalidatePath("/dashboard");
  return { ok: true };
}