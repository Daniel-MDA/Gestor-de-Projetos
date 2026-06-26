// Tipos e constantes da seção Prospecção — SEM dependências server-only,
// para poder ser importado tanto pelo componente client quanto por dados.ts/acoes.ts.

// Enum playbook_participacao (10_playbook.sql) — acentos exatos.
export type Participacao =
  | "A avaliar"
  | "Stand"
  | "Presença de equipe"
  | "Stand + equipe";

export const PARTICIPACAO_OPCOES: Participacao[] = [
  "A avaliar",
  "Stand",
  "Presença de equipe",
  "Stand + equipe",
];

export type ProspEvento = {
  id: string;
  setor_id: string;
  nome: string;
  link: string | null;
  participacao: Participacao;
  obs: string | null;
  ordem: number;
};

export type ProspSetor = {
  id: string;
  slug: string | null;
  nome: string;
  ordem: number;
  eventos: ProspEvento[];
};

export type Dados = {
  setores: ProspSetor[];
};
