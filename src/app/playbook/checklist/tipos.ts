// Tipos e constantes da seção Checklist / Página da Feira — SEM dependências
// server-only, para poder ser importado tanto pelos componentes client quanto
// por dados.ts/acoes.ts. (O client NUNCA importa valores de dados.ts.)

// ── Enums do banco (10_playbook.sql) — valores EXATOS, com acentos ───────────

// enum playbook_doc_slot
export type DocSlot = "stand" | "buffet" | "organizacao" | "planta" | "outro";

// enum playbook_lead_origem
export type LeadOrigem = "Cartão de visita" | "Aplicativo" | "Outro";

// Os 4 slots fixos de documentos da logística (na ordem de exibição).
export const DOC_SLOTS: {
  key: Exclude<DocSlot, "outro">;
  titulo: string;
  icon: string;
  desc: string;
}[] = [
  {
    key: "stand",
    titulo: "Projeto do stand",
    icon: "📐",
    desc: "PDF do projeto / render do stand.",
  },
  {
    key: "buffet",
    titulo: "Contrato de buffet",
    icon: "🍽️",
    desc: "Contrato do buffet / catering do evento.",
  },
  {
    key: "organizacao",
    titulo: "Contrato com a organização",
    icon: "🤝",
    desc: "Contrato assinado com a organizadora da feira.",
  },
  {
    key: "planta",
    titulo: "Planta baixa da feira",
    icon: "🗺️",
    desc: "Planta baixa / mapa do pavilhão e do estande.",
  },
];

// Opções de origem para o <select> dos leads manuais.
export const ORIGEM_OPCOES: LeadOrigem[] = [
  "Cartão de visita",
  "Aplicativo",
  "Outro",
];

// Abas da página da feira (ordem dos botões).
export type Aba = "logistica" | "checklist" | "leads" | "portal";
export const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "logistica", rotulo: "Logística & Stand" },
  { id: "checklist", rotulo: "Checklist" },
  { id: "leads", rotulo: "Captação de Leads" },
  { id: "portal", rotulo: "Portal do Expositor" },
];

// ── Árvore do checklist (compartilhada por todas as feiras) ──────────────────

export type Item = {
  id: string;
  categoria_id: string;
  slug: string | null;
  nome: string;
  ordem: number;
};

export type Categoria = {
  id: string;
  slug: string | null;
  nome: string;
  setor_id: string | null;
  ordem: number;
  itens: Item[];
};

export type Setor = {
  id: string;
  nome: string;
  ordem: number;
};

// Uma feira (playbook_eventos) usada no seletor.
export type Evento = {
  id: string;
  nome: string;
  local: string | null;
  data: string;
  status: string;
  ordem: number;
};

// ── Estado POR FEIRA (indexado por evento_id no objeto Dados) ────────────────

// playbook_checklist_marcacoes — uma marcação (marcado + qtd) de um item.
export type Marcacao = {
  marcado: boolean;
  qtd: number | null;
};

// playbook_logistica_docs — um documento de logística.
export type LogisticaDoc = {
  id: string;
  slot: DocSlot;
  titulo: string | null;
  nome_arquivo: string | null;
  storage_path: string | null;
  link: string | null;
  ordem: number;
};

// playbook_custos — um custo do evento.
export type Custo = {
  id: string;
  descricao: string;
  valor: number;
  ordem: number;
};

// playbook_logistica (+ docs + custos) — 1 por feira.
export type Logistica = {
  id: string;
  evento_id: string;
  hotel: string | null;
  transporte: string | null;
  obs: string | null;
  colaboradores: string[];
  docs: LogisticaDoc[];
  custos: Custo[];
};

// playbook_leads_manuais — um lead pessoal (PII / LGPD).
export type LeadManual = {
  id: string;
  nome: string | null;
  empresa: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  origem: LeadOrigem;
  obs: string | null;
  ordem: number;
};

// playbook_leads (+ manuais) — 1 por feira.
export type Leads = {
  id: string;
  evento_id: string;
  planilha_nome: string | null;
  planilha_storage_path: string | null;
  planilha_link: string | null;
  manual_planilha_nome: string | null;
  manual_planilha_storage_path: string | null;
  manual_planilha_link: string | null;
  manuais: LeadManual[];
};

// playbook_portais — credenciais (1 por feira).
export type Portal = {
  id: string;
  evento_id: string;
  link: string | null;
  login: string | null;
  senha: string | null;
};

// Pacote completo entregue ao componente client.
export type Dados = {
  eventos: Evento[];
  // árvore compartilhada
  setores: Setor[];
  categorias: Categoria[];
  // estado por feira, indexado por evento_id
  marcacoes: Record<string, Record<string, Marcacao>>; // [eventoId][itemId]
  logistica: Record<string, Logistica>;
  leads: Record<string, Leads>;
  portais: Record<string, Portal>;
};

// Campos editáveis (texto) da logística e leads/portal — usados pelas ações.
export type CampoLogistica = "hotel" | "transporte" | "obs";
export type CampoLeads =
  | "planilha_link"
  | "manual_planilha_link";
export type CampoPortal = "link" | "login" | "senha";
