"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tarefa } from "@/lib/tarefas";

type Callbacks = {
  onInsert?: (t: Tarefa) => void;
  onUpdate?: (t: Tarefa) => void;
  onDelete?: (id: string) => void;
};

/**
 * Hook que se conecta ao canal realtime do Supabase para uma tabela `tarefas`
 * filtrada por projeto. Dispara callbacks ao receber eventos.
 */
export function useTarefasRealtime(projetoId: string | null, callbacks: Callbacks) {
  useEffect(() => {
    if (!projetoId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`tarefas-${projetoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tarefas",
          filter: `projeto_id=eq.${projetoId}`,
        },
        (payload) => {
          callbacks.onInsert?.(payload.new as Tarefa);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tarefas",
          filter: `projeto_id=eq.${projetoId}`,
        },
        (payload) => {
          callbacks.onUpdate?.(payload.new as Tarefa);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tarefas",
          filter: `projeto_id=eq.${projetoId}`,
        },
        (payload) => {
          callbacks.onDelete?.((payload.old as { id: string }).id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);
}
