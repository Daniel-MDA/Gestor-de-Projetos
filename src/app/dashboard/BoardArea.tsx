"use client";

import { useState } from "react";
import { Tarefa } from "@/lib/tarefas";
import { PapelProjeto } from "@/lib/permissoes";
import { MembroAtribuicao } from "@/lib/responsavel";
import Kanban from "./Kanban";
import TaskList from "./TaskList";
import TaskModal from "./TaskModal";

type Props = {
  tarefasIniciais: Tarefa[];
  projetoId: string;
  papel: PapelProjeto | null;
  usuarioAtualId: string;
  membros: MembroAtribuicao[];
};

export default function BoardArea({
  tarefasIniciais,
  projetoId,
  papel,
  usuarioAtualId,
  membros,
}: Props) {
  // Lista de tarefas vive aqui (única fonte de verdade compartilhada
  // entre Kanban e TaskList).
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);
  const [tarefaSelecionada, setTarefaSelecionada] = useState<Tarefa | null>(null);

  const podeEditarBool = papel === "admin" || papel === "editor";

  return (
    <div className="space-y-5">
      <Kanban
        tarefas={tarefas}
        setTarefas={setTarefas}
        projetoId={projetoId}
        papel={papel}
        usuarioAtualId={usuarioAtualId}
        membros={membros}
        onTaskClick={(t) => setTarefaSelecionada(t)}
      />

      <TaskList tarefas={tarefas} onTaskClick={(t) => setTarefaSelecionada(t)} />

      {tarefaSelecionada && (
        <TaskModal
          tarefa={tarefaSelecionada}
          projetoId={projetoId}
          papel={papel}
          podeEditar={podeEditarBool}
          usuarioAtualId={usuarioAtualId}
          membros={membros}
          onClose={() => setTarefaSelecionada(null)}
          onSaved={(atualizada) => {
            setTarefas((prev) =>
              prev.map((t) => (t.id === atualizada.id ? atualizada : t))
            );
            setTarefaSelecionada(null);
          }}
          onDeleted={(tarefaId) => {
            setTarefas((prev) => prev.filter((t) => t.id !== tarefaId));
            setTarefaSelecionada(null);
          }}
        />
      )}
    </div>
  );
}