// Tipos e constantes da seção Catálogos — SEM dependências server-only,
// para poder ser importado tanto pelo componente client quanto por dados.ts/acoes.ts.

// Enum playbook_grupo_catalogo (10_playbook.sql) — valores exatos.
export type GrupoCatalogo = "gerais" | "powerpoxi";

export const GRUPO_OPCOES: { valor: GrupoCatalogo; rotulo: string }[] = [
  { valor: "gerais", rotulo: "Catálogos Gerais" },
  { valor: "powerpoxi", rotulo: "Catálogos PowerPoxi" },
];

// Limiar de status "ATENÇÃO" (replica calcStatus do HTML: s < 200).
export const LIMIAR_ATENCAO = 200;

// Um evento/feira que consome catálogo (uma das 7 colunas, ordem 0..6).
export type EventoCatalogo = {
  id: string;
  nome: string;
  data: string | null;
  ordem: number;
};

// Um catálogo, com o estoque atual e o consumo anual já realizado/previsto.
// `consumo` em cada evento vem em `consumoPorEvento` (chave = evento_catalogo_id).
export type Catalogo = {
  id: string;
  nome: string;
  grupo: GrupoCatalogo;
  estoque: number;
  consumo_anual: number;
  is_custom: boolean;
  ordem: number;
  // qtd consumida em cada evento, indexada pelo id do evento de catálogo.
  consumoPorEvento: Record<string, number>;
};

export type Dados = {
  eventos: EventoCatalogo[]; // as 7 colunas de evento, ordenadas por 'ordem'
  catalogos: Catalogo[];
};
