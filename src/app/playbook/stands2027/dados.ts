import { createClient } from "@/lib/supabase/server";
import type { Dados, Stand, StandDoc } from "./tipos";

// Re-exporta os tipos para quem importa de "./dados" (ex.: acoes.ts).
export type { StandStatus, StandDocSlot, StandDoc, Stand, Dados } from "./tipos";

// Busca os stands de 2027 e seus documentos, ordenados por 'ordem'.
// Leitura pública via RLS.
export async function carregar(): Promise<Dados> {
  const supabase = await createClient();

  const [standsRes, docsRes] = await Promise.all([
    supabase
      .from("playbook_stands2027")
      .select("id, nome, local, data, data_limite, status, valor, obs, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_stand_docs")
      .select("id, stand_id, slot, nome_arquivo, storage_path, link"),
  ]);

  if (standsRes.error)
    throw new Error("Falha ao carregar stands: " + standsRes.error.message);
  if (docsRes.error)
    throw new Error(
      "Falha ao carregar documentos dos stands: " + docsRes.error.message
    );

  const docs = (docsRes.data ?? []) as StandDoc[];
  const standsBase = (standsRes.data ?? []) as Omit<Stand, "docs">[];

  const stands: Stand[] = standsBase.map((s) => ({
    ...s,
    docs: docs.filter((d) => d.stand_id === s.id),
  }));

  return { stands };
}
