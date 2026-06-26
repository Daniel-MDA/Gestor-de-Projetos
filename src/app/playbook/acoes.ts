"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { StatusEvento } from "@/lib/playbook";

// Resultado padrão das ações (espelha o padrão {status} das RPCs do projeto).
export type ResultadoAcao = { status: "ok" | "nao_autenticado" | "erro"; mensagem?: string };

const CICLO_STATUS: Record<StatusEvento, StatusEvento> = {
  "NÃO INICIADO": "EM ANDAMENTO",
  "EM ANDAMENTO": "CONCLUÍDO",
  "CONCLUÍDO": "NÃO INICIADO",
};

// Avança o status do evento para o próximo do ciclo.
// A autorização real é do RLS (UPDATE só para is_playbook_editor()); aqui só
// barramos sessão ausente e damos feedback amigável.
export async function ciclarStatusEvento(
  id: string,
  statusAtual: StatusEvento
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const novo = CICLO_STATUS[statusAtual] ?? "EM ANDAMENTO";
  const { error } = await supabase
    .from("playbook_eventos")
    .update({ status: novo, atualizado_por: user.id })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
