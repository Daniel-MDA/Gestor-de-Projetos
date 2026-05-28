/**
 * Utilidades para o campo `tarefas.responsavel`.
 *
 * O campo é text e aceita 2 formatos:
 *   - UUID de um membro (novo padrão): "cce41c39-f419-4b9c-8099-1e2b7097070a"
 *   - Texto livre (legado da migração inicial do XLSX): "Daniel", "Equipe..."
 *
 * A UI nova sempre grava UUID; mas tarefas antigas mantêm texto.
 * As funções abaixo decidem como mostrar / interpretar cada caso.
 */

export type MembroAtribuicao = {
  usuario_id: string;
  email: string;
  display_name: string | null;
};

// Regex relaxado para identificar UUIDs no formato padrão
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return UUID_REGEX.test(valor.trim());
}

/**
 * Dado o valor cru do campo `responsavel` e a lista de membros, retorna
 * o que mostrar pro usuário. Prioridade:
 *   1. UUID → busca membro → "Display Name" ou "email" se sem nome
 *   2. UUID não encontrado nos membros → "(usuário removido)"
 *   3. Texto livre → mostra como veio
 *   4. Vazio → "—"
 */
export function exibirResponsavel(
  valor: string | null | undefined,
  membros: MembroAtribuicao[]
): string {
  if (!valor || !valor.trim()) return "—";

  const trimmed = valor.trim();

  if (ehUuid(trimmed)) {
    const membro = membros.find((m) => m.usuario_id === trimmed);
    if (!membro) return "(usuário removido)";
    return membro.display_name || membro.email;
  }

  // Texto livre (legado)
  return trimmed;
}

/**
 * Quando estiver editando, decide qual opção de select pré-selecionar.
 * Retorna UUID se for UUID válido E membro existir; senão retorna null
 * (e a UI deve cair pra opção "texto livre" ou vazio).
 */
export function uuidSelecionadoOuNulo(
  valor: string | null | undefined,
  membros: MembroAtribuicao[]
): string | null {
  if (!valor) return null;
  const trimmed = valor.trim();
  if (!ehUuid(trimmed)) return null;
  const membro = membros.find((m) => m.usuario_id === trimmed);
  return membro ? trimmed : null;
}

/**
 * Texto curto para mostrar em selects: "Display Name" ou só email.
 */
export function rotuloMembro(m: MembroAtribuicao): string {
  if (m.display_name && m.display_name.trim()) {
    return `${m.display_name} (${m.email})`;
  }
  return m.email;
}