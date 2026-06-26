// Infra compartilhada de Storage do playbook.
// Buckets criados em 10_playbook.sql:
//  - playbook-publico (public=true): docs de logística e stands — leitura anônima.
//  - playbook-leads   (private):     planilhas de leads (PII) — leitura só-logado.
export const BUCKET_PUBLICO = "playbook-publico";
export const BUCKET_LEADS = "playbook-leads";

// Normaliza o nome do arquivo para um path seguro de Storage.
export function nomeSeguro(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 120) || "arquivo"
  );
}
