"use server";

import { createClient } from "@/lib/supabase/server";
import { BUCKET_ANEXOS } from "@/lib/anexos";

type Resultado = { ok: true } | { ok: false; erro: string };

export async function excluirTarefaAction(
  tarefaId: string
): Promise<Resultado> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  // 1. Lista anexos da tarefa (paths no Storage)
  const { data: listaData, error: listaErr } = await supabase.rpc(
    "listar_anexos_tarefa",
    { p_tarefa_id: tarefaId }
  );

  if (listaErr) return { ok: false, erro: listaErr.message };
  const lista = listaData as
    | { status: "ok"; paths: string[] }
    | { status: "nao_autorizado" }
    | { status: "tarefa_nao_encontrada" };

  if (lista.status === "nao_autorizado") {
    return { ok: false, erro: "Sem permissão para acessar esta tarefa." };
  }
  if (lista.status === "tarefa_nao_encontrada") {
    return { ok: false, erro: "Tarefa não encontrada." };
  }

  // 2. Remove arquivos do Storage (best-effort: se falhar, segue mesmo assim)
  if (lista.paths.length > 0) {
    const { error: rmErr } = await supabase.storage
      .from(BUCKET_ANEXOS)
      .remove(lista.paths);
    if (rmErr) {
      console.error("Falha ao remover anexos do Storage:", rmErr);
    }
  }

  // 3. Chama RPC excluir_tarefa (cascade no banco apaga comentários e anexos)
  const { data, error } = await supabase.rpc("excluir_tarefa", {
    p_tarefa_id: tarefaId,
  });

  if (error) return { ok: false, erro: error.message };

  const r = data as { status: string };

  if (r.status === "nao_autorizado") {
    return {
      ok: false,
      erro: "Apenas administradores ou o criador podem excluir esta tarefa.",
    };
  }
  if (r.status === "tarefa_nao_encontrada") {
    return { ok: false, erro: "Tarefa não encontrada." };
  }
  if (r.status !== "ok") {
    return { ok: false, erro: "Erro: " + r.status };
  }

  return { ok: true };
}