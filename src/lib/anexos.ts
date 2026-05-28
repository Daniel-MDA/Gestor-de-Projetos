export type Anexo = {
  id: string;
  tarefa_id: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number;
  tipo_mime: string | null;
  enviado_por: string;
  enviado_em: string;
};

export const BUCKET_ANEXOS = "anexos-tarefas";
export const MAX_TAMANHO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Formata "1234567" bytes → "1,2 MB"
 */
export function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Sanitiza nome de arquivo pra evitar problemas no storage.
 * Remove caracteres especiais, mantém ponto da extensão, espaços viram underscore.
 */
export function sanitizarNomeArquivo(nome: string): string {
  // Separa nome e extensão
  const idx = nome.lastIndexOf(".");
  const base = idx > 0 ? nome.slice(0, idx) : nome;
  const ext = idx > 0 ? nome.slice(idx) : "";

  const baseClean = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);

  const extClean = ext
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "")
    .toLowerCase();

  return (baseClean || "arquivo") + extClean;
}

/**
 * Constrói o path no Storage: {projeto_id}/{tarefa_id}/{timestamp}_{nome}
 */
export function construirStoragePath(
  projetoId: string,
  tarefaId: string,
  nomeArquivo: string
): string {
  const timestamp = Date.now();
  const nomeLimpo = sanitizarNomeArquivo(nomeArquivo);
  return `${projetoId}/${tarefaId}/${timestamp}_${nomeLimpo}`;
}

/**
 * Ícone (emoji) baseado no tipo MIME.
 */
export function iconeArquivo(tipo: string | null): string {
  if (!tipo) return "📄";
  if (tipo.startsWith("image/")) return "🖼";
  if (tipo.startsWith("video/")) return "🎬";
  if (tipo.startsWith("audio/")) return "🎵";
  if (tipo.includes("pdf")) return "📕";
  if (tipo.includes("word") || tipo.includes("document")) return "📘";
  if (tipo.includes("sheet") || tipo.includes("excel")) return "📗";
  if (tipo.includes("presentation") || tipo.includes("powerpoint")) return "📙";
  if (tipo.includes("zip") || tipo.includes("compressed")) return "🗜";
  return "📄";
}
