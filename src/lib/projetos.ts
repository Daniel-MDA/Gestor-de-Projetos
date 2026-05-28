export type Projeto = {
  id: string;
  nome: string;
  descricao: string | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  arquivado: boolean;
};

export type PapelProjeto = "admin" | "editor" | "leitor";

export type MembroComUsuario = {
  projeto_id: string;
  usuario_id: string;
  papel: PapelProjeto;
  adicionado_em: string;
  adicionado_por: string | null;
  usuario_email: string;
};

export type UsuarioPublico = {
  id: string;
  email: string;
  nome: string | null;
};

export const PAPEIS_INFO: Record<
  PapelProjeto,
  { label: string; descricao: string; cor: string }
> = {
  admin: {
    label: "Administrador",
    descricao:
      "Edita tudo + gerencia membros + pode arquivar projeto",
    cor: "#8c2c1b",
  },
  editor: {
    label: "Editor",
    descricao: "Edita tarefas, comentários e anexos",
    cor: "#1d4d8a",
  },
  leitor: {
    label: "Leitor",
    descricao: "Apenas visualiza — sem permissão de edição",
    cor: "#4b4942",
  },
};