import { createClient } from "@/lib/supabase/server";

// Linha da tabela playbook_associacao_beneficios.
export type Beneficio = {
  id: string;
  associacao_id: string;
  texto: string;
  ordem: number;
};

// Linha da tabela playbook_associacoes + seus benefícios (filhos) já aninhados.
export type Associacao = {
  id: string;
  slug: string | null;
  nome: string;
  desconto: number | null;
  ordem: number;
  beneficios: Beneficio[];
};

export type Dados = {
  associacoes: Associacao[];
};

// Busca associações + benefícios (SELECT público via RLS), ordenados por 'ordem'.
// Aninha os benefícios em cada associação no cliente do servidor.
export async function carregar(): Promise<Dados> {
  const supabase = await createClient();

  const [assocRes, benefRes] = await Promise.all([
    supabase
      .from("playbook_associacoes")
      .select("id, slug, nome, desconto, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("playbook_associacao_beneficios")
      .select("id, associacao_id, texto, ordem")
      .order("ordem", { ascending: true }),
  ]);

  if (assocRes.error)
    throw new Error("Falha ao carregar associações: " + assocRes.error.message);
  if (benefRes.error)
    throw new Error(
      "Falha ao carregar benefícios: " + benefRes.error.message
    );

  type AssocRow = {
    id: string;
    slug: string | null;
    nome: string;
    desconto: number | string | null;
    ordem: number;
  };
  const assocRows = (assocRes.data ?? []) as AssocRow[];
  const benefRows = (benefRes.data ?? []) as Beneficio[];

  const porAssoc = new Map<string, Beneficio[]>();
  for (const b of benefRows) {
    const lista = porAssoc.get(b.associacao_id);
    if (lista) lista.push(b);
    else porAssoc.set(b.associacao_id, [b]);
  }

  const associacoes: Associacao[] = assocRows.map((a) => ({
    id: a.id,
    slug: a.slug,
    nome: a.nome,
    // numeric(5,2) pode chegar como string do supabase-js; normalizamos.
    desconto:
      a.desconto === null || a.desconto === undefined
        ? null
        : typeof a.desconto === "string"
          ? Number(a.desconto)
          : a.desconto,
    ordem: a.ordem,
    beneficios: porAssoc.get(a.id) ?? [],
  }));

  return { associacoes };
}
