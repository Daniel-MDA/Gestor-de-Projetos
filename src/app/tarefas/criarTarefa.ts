"use server";

import { createClient } from "@/lib/supabase/server";
import { Prioridade } from "@/lib/tarefas";

type Resultado =
  | { ok: true; tarefaId: string; codigo: string }
  | { ok: false; erro: string };

export async function criarTarefaAction(input: {
  projetoId: string;
  titulo: string;
  fase: string;
  descricao?: string | null;
  responsavel?: string | null;
  dataInicio?: string | null; // YYYY-MM-DD
  prazo?: string | null; // YYYY-MM-DD
  prioridade?: Prioridade;
}): Promise<Resultado> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, erro: "Sessão expirada." };
  }

  const { data, error } = await supabase.rpc("criar_tarefa", {
    p_projeto_id: input.projetoId,
    p_titulo: input.titulo,
    p_fase: input.fase,
    p_descricao: input.descricao ?? null,
    p_responsavel: input.responsavel ?? null,
    p_data_inicio: input.dataInicio ?? null,
    p_prazo: input.prazo ?? null,
    p_prioridade: input.prioridade ?? "Média",
  });

  if (error) {
    return { ok: false, erro: "Erro ao criar tarefa: " + error.message };
  }

  const r = data as {
    status: string;
    tarefa_id?: string;
    codigo?: string;
  };

  if (r.status === "nao_autorizado") {
    return {
      ok: false,
      erro: "Você não tem permissão para criar tarefas neste projeto.",
    };
  }
  if (r.status === "projeto_nao_encontrado") {
    return { ok: false, erro: "Projeto não encontrado." };
  }
  if (r.status === "titulo_vazio") {
    return { ok: false, erro: "Informe um título para a tarefa." };
  }
  if (r.status === "limite_codigo_atingido") {
    return {
      ok: false,
      erro: "Limite de tarefas por projeto atingido (TASK-999).",
    };
  }
  if (r.status !== "ok") {
    return { ok: false, erro: "Erro: " + r.status };
  }

  return {
    ok: true,
    tarefaId: r.tarefa_id!,
    codigo: r.codigo!,
  };
}