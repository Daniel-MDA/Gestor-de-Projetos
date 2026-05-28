"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type Comentario = {
  id: string;
  tarefa_id: string;
  autor_id: string;
  texto: string;
  criado_em: string;
  editado_em: string | null;
};

/**
 * Formata "2026-05-15T17:30:00Z" → "15/05/2026 às 14:30"
 */
export function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aa = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${aa} às ${hh}:${min}`;
}

/**
 * Tempo relativo: "há 5 minutos", "ontem", "há 3 dias"
 */
export function tempoRelativo(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const seg = Math.floor((agora.getTime() - d.getTime()) / 1000);

  if (seg < 60) return "agora";
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 86400 * 2) return "ontem";
  if (seg < 86400 * 7) return `há ${Math.floor(seg / 86400)} dias`;
  return fmtDataHora(iso);
}

/**
 * Detecta URLs no texto e renderiza como links.
 * Retorna array de nodes (string ou JSX-like marker).
 */
export function quebrarTextoEmLinks(texto: string): React.ReactNode[] {
  const regex = /(https?:\/\/[^\s]+)/g;
  const partes: React.ReactNode[] = [];
  let ultimo = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimo) {
      partes.push(texto.slice(ultimo, match.index));
    }
    partes.push({
      type: "link",
      key: i++,
      url: match[1],
    } as never);
    ultimo = match.index + match[1].length;
  }
  if (ultimo < texto.length) {
    partes.push(texto.slice(ultimo));
  }
  return partes;
}

type Callbacks = {
  onInsert?: (c: Comentario) => void;
  onUpdate?: (c: Comentario) => void;
  onDelete?: (id: string) => void;
};

/**
 * Escuta mudanças em comentários de uma tarefa específica.
 */
export function useComentariosRealtime(tarefaId: string | null, callbacks: Callbacks) {
  useEffect(() => {
    if (!tarefaId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`comentarios-${tarefaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comentarios",
          filter: `tarefa_id=eq.${tarefaId}`,
        },
        (payload) => callbacks.onInsert?.(payload.new as Comentario)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "comentarios",
          filter: `tarefa_id=eq.${tarefaId}`,
        },
        (payload) => callbacks.onUpdate?.(payload.new as Comentario)
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "comentarios",
          filter: `tarefa_id=eq.${tarefaId}`,
        },
        (payload) => callbacks.onDelete?.((payload.old as { id: string }).id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaId]);
}
