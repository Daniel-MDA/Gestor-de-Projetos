import { createClient } from "@/lib/supabase/server";
import type { Dados, ProspSetor, ProspEvento } from "./tipos";

// Re-exporta os tipos para quem importa de "./dados" (ex.: acoes.ts).
export type { Participacao, ProspEvento, ProspSetor, Dados } from "./tipos";

export async function carregar(): Promise<Dados> {
  const supabase = await createClient();

  const [setoresRes, eventosRes] = await Promise.all([
    supabase
      .from("playbook_prospeccao_setores")
      .select("id, slug, nome, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_prospeccao_eventos")
      .select("id, setor_id, nome, link, participacao, obs, ordem")
      .order("ordem", { ascending: true }),
  ]);

  if (setoresRes.error)
    throw new Error("Falha ao carregar setores: " + setoresRes.error.message);
  if (eventosRes.error)
    throw new Error("Falha ao carregar eventos: " + eventosRes.error.message);

  const setoresRaw = (setoresRes.data ?? []) as Omit<ProspSetor, "eventos">[];
  const eventosRaw = (eventosRes.data ?? []) as ProspEvento[];

  const setores: ProspSetor[] = setoresRaw.map((s) => ({
    ...s,
    eventos: eventosRaw.filter((e) => e.setor_id === s.id),
  }));

  return { setores };
}
