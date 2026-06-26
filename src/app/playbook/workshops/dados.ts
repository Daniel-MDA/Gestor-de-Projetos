import { createClient } from "@/lib/supabase/server";

// Um produto apresentado num workshop (tabela filha).
export type WorkshopProduto = {
  id: string;
  workshop_id: string;
  texto: string;
  ordem: number;
};

// Um workshop registrado (tabela pai), com seus produtos já agrupados.
export type Workshop = {
  id: string;
  tema: string;
  organizador: string | null;
  local: string | null;
  data: string | null;
  obs: string | null;
  ordem: number;
  produtos: WorkshopProduto[];
};

export type Dados = {
  workshops: Workshop[];
};

// Linhas cruas vindas do supabase (antes do agrupamento).
type WorkshopRow = {
  id: string;
  tema: string | null;
  organizador: string | null;
  local: string | null;
  data: string | null;
  obs: string | null;
  ordem: number;
};

// Busca workshops e produtos (leitura pública via RLS) e agrupa os produtos
// dentro de cada workshop, tudo ordenado por 'ordem'.
export async function carregar(): Promise<Dados> {
  const supabase = await createClient();

  const [wsRes, prodRes] = await Promise.all([
    supabase
      .from("playbook_workshops")
      .select("id, tema, organizador, local, data, obs, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_workshop_produtos")
      .select("id, workshop_id, texto, ordem")
      .order("ordem", { ascending: true }),
  ]);

  if (wsRes.error)
    throw new Error("Falha ao carregar workshops: " + wsRes.error.message);
  if (prodRes.error)
    throw new Error(
      "Falha ao carregar produtos de workshops: " + prodRes.error.message
    );

  const rows = (wsRes.data ?? []) as WorkshopRow[];
  const produtos = (prodRes.data ?? []) as WorkshopProduto[];

  const workshops: Workshop[] = rows.map((w) => ({
    id: w.id,
    tema: w.tema ?? "",
    organizador: w.organizador,
    local: w.local,
    data: w.data,
    obs: w.obs,
    ordem: w.ordem,
    produtos: produtos.filter((p) => p.workshop_id === w.id),
  }));

  return { workshops };
}
