import { createClient } from "@/lib/supabase/server";
import type { Dados, EventoCatalogo, Catalogo, GrupoCatalogo } from "./tipos";

// Re-exporta os tipos para quem importa de "./dados".
export type { GrupoCatalogo, EventoCatalogo, Catalogo, Dados } from "./tipos";

// Linha crua de playbook_catalogo_consumo.
type ConsumoRow = {
  catalogo_id: string;
  evento_catalogo_id: string;
  qtd: number;
};

// Busca eventos de catálogo, catálogos e o consumo por evento. Leitura pública via RLS.
export async function carregar(): Promise<Dados> {
  const supabase = await createClient();

  const [eventosRes, catalogosRes, consumoRes] = await Promise.all([
    supabase
      .from("playbook_eventos_catalogo")
      .select("id, nome, data, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_catalogos")
      .select("id, nome, grupo, estoque, consumo_anual, is_custom, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_catalogo_consumo")
      .select("catalogo_id, evento_catalogo_id, qtd"),
  ]);

  if (eventosRes.error)
    throw new Error(
      "Falha ao carregar eventos de catálogo: " + eventosRes.error.message
    );
  if (catalogosRes.error)
    throw new Error("Falha ao carregar catálogos: " + catalogosRes.error.message);
  if (consumoRes.error)
    throw new Error("Falha ao carregar consumo: " + consumoRes.error.message);

  const eventos = (eventosRes.data ?? []) as EventoCatalogo[];
  const catalogosRaw = (catalogosRes.data ?? []) as Omit<
    Catalogo,
    "consumoPorEvento"
  >[];
  const consumo = (consumoRes.data ?? []) as ConsumoRow[];

  const catalogos: Catalogo[] = catalogosRaw.map((c) => {
    const consumoPorEvento: Record<string, number> = {};
    for (const r of consumo) {
      if (r.catalogo_id === c.id)
        consumoPorEvento[r.evento_catalogo_id] = r.qtd;
    }
    return { ...c, consumoPorEvento };
  });

  return { eventos, catalogos };
}
