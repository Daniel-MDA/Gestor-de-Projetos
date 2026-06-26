import { createClient } from "@/lib/supabase/server";

// Uma saída/uso registrado de um brinde (motivo + quantidade).
export type BrindeUso = {
  id: string;
  brinde_id: string;
  motivo: string | null;
  qtd: number;
  ordem: number;
};

// Um brinde com seu estoque inicial e a lista de saídas associadas.
export type Brinde = {
  id: string;
  slug: string | null;
  nome: string;
  estoque_inicial: number | null;
  ordem: number;
  usos: BrindeUso[];
};

export type Dados = {
  brindes: Brinde[];
};

// Busca os brindes e suas saídas, ordenados por 'ordem'. Leitura pública via RLS.
export async function carregar(): Promise<Dados> {
  const supabase = await createClient();

  const [brindesRes, usosRes] = await Promise.all([
    supabase
      .from("playbook_brindes")
      .select("id, slug, nome, estoque_inicial, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_brinde_usos")
      .select("id, brinde_id, motivo, qtd, ordem")
      .order("ordem", { ascending: true }),
  ]);

  if (brindesRes.error)
    throw new Error("Falha ao carregar brindes: " + brindesRes.error.message);
  if (usosRes.error)
    throw new Error("Falha ao carregar saídas de brindes: " + usosRes.error.message);

  const usos = (usosRes.data ?? []) as BrindeUso[];
  const brindesBase = (brindesRes.data ?? []) as Omit<Brinde, "usos">[];

  const brindes: Brinde[] = brindesBase.map((b) => ({
    ...b,
    usos: usos.filter((u) => u.brinde_id === b.id),
  }));

  return { brindes };
}
