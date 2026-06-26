// Tipos e constantes da seção Stands 2027 — SEM dependências server-only,
// para poder ser importado tanto pelo componente client quanto por dados.ts/acoes.ts.

// Enum playbook_stand_status (10_playbook.sql) — acentos exatos.
export type StandStatus =
  | "A avaliar"
  | "Orçamento solicitado"
  | "Reservado"
  | "Confirmado / Pago";

export const STAND_STATUS_OPCOES: StandStatus[] = [
  "A avaliar",
  "Orçamento solicitado",
  "Reservado",
  "Confirmado / Pago",
];

// Enum playbook_stand_doc_slot (10_playbook.sql).
export type StandDocSlot = "planta" | "projeto";

// Rótulos exibidos para cada slot de documento.
export const STAND_DOC_SLOTS: { slot: StandDocSlot; titulo: string }[] = [
  { slot: "planta", titulo: "Planta baixa" },
  { slot: "projeto", titulo: "Projeto do stand" },
];

// Um documento de stand (na v1 usamos apenas o campo 'link').
export type StandDoc = {
  id: string;
  stand_id: string;
  slot: StandDocSlot;
  nome_arquivo: string | null;
  storage_path: string | null;
  link: string | null;
};

// Um stand/evento de 2027 com a lista de seus documentos.
export type Stand = {
  id: string;
  nome: string | null;
  local: string | null;
  data: string | null;
  data_limite: string | null;
  status: StandStatus;
  valor: number | null;
  obs: string | null;
  ordem: number;
  docs: StandDoc[];
};

export type Dados = {
  stands: Stand[];
};
