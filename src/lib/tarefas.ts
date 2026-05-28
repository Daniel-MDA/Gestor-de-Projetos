/* tarefas.ts
 */

export type Tarefa = {
  id: string;
  projeto_id: string;
  codigo: string;
  fase: string;
  titulo: string;
  descricao: string | null;
  responsavel: string | null;
  data_inicio: string | null;
  prazo: string | null;
  prioridade: "Alta" | "Média" | "Baixa";
  status: "Não iniciada" | "Em progresso" | "Em revisão" | "Concluída" | "Atrasada";
  data_conclusao: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type StatusEfetivo = Tarefa["status"];
export type Prioridade = Tarefa["prioridade"];

export const STATUSES: StatusEfetivo[] = [
  "Não iniciada",
  "Em progresso",
  "Em revisão",
  "Concluída",
  "Atrasada",
];

export const PRIORIDADES: Prioridade[] = ["Alta", "Média", "Baixa"];

/**
 * Payload para atualização parcial de tarefa.
 */
export type TarefaUpdate = Partial<{
  fase: string;
  titulo: string;
  descricao: string | null;
  responsavel: string | null;
  data_inicio: string | null;
  prazo: string | null;
  prioridade: Prioridade;
  status: StatusEfetivo;
  data_conclusao: string | null;
}>;

/**
 * Calcula o status efetivo da tarefa.
 * Uma tarefa não concluída com prazo vencido vira "Atrasada" automaticamente.
 */
export function statusEfetivo(t: Tarefa): StatusEfetivo {
  if (t.status === "Concluída") return "Concluída";
  if (t.prazo) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const prazoDate = new Date(t.prazo + "T00:00:00");
    if (prazoDate < hoje) return "Atrasada";
  }
  return t.status;
}

/**
 * Agrupa tarefas por fase, preservando ordem de aparição.
 */
export function agruparPorFase(tarefas: Tarefa[]): { fase: string; tarefas: Tarefa[] }[] {
  const map = new Map<string, Tarefa[]>();
  for (const t of tarefas) {
    if (!map.has(t.fase)) map.set(t.fase, []);
    map.get(t.fase)!.push(t);
  }
  return Array.from(map.entries()).map(([fase, ts]) => ({ fase, tarefas: ts }));
}

/**
 * Agrupa tarefas por status efetivo (considerando atraso automático).
 */
export function agruparPorStatus(tarefas: Tarefa[]): Map<StatusEfetivo, Tarefa[]> {
  const map = new Map<StatusEfetivo, Tarefa[]>();
  for (const s of STATUSES) map.set(s, []);
  for (const t of tarefas) {
    const s = statusEfetivo(t);
    map.get(s)!.push(t);
  }
  return map;
}

/**
 * Calcula estatísticas globais do projeto.
 */
export function calcularKPIs(tarefas: Tarefa[]) {
  const total = tarefas.length;
  const efetivos = tarefas.map(statusEfetivo);
  const concluidas = efetivos.filter((s) => s === "Concluída").length;
  const emAndamento = efetivos.filter(
    (s) => s === "Em progresso" || s === "Em revisão"
  ).length;
  const atrasadas = efetivos.filter((s) => s === "Atrasada").length;
  const autoLate = tarefas.filter(
    (t) => statusEfetivo(t) === "Atrasada" && t.status !== "Atrasada"
  ).length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return { total, concluidas, emAndamento, atrasadas, autoLate, progresso };
}

/**
 * Calcula estatísticas de uma fase específica.
 */
export function calcularStatsFase(tarefas: Tarefa[]) {
  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => statusEfetivo(t) === "Concluída").length;
  const algumaAtrasada = tarefas.some((t) => statusEfetivo(t) === "Atrasada");
  const todasConcluidas = total > 0 && concluidas === total;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const prazos = tarefas.map((t) => t.prazo).filter((p): p is string => p !== null);
  const prazoFinal = prazos.length > 0 ? prazos.sort().at(-1)! : null;

  return { total, concluidas, algumaAtrasada, todasConcluidas, pct, prazoFinal };
}

/**
 * Formata "2026-06-05" → "05/06/2026"
 */
export function fmtData(d: string | null) {
  if (!d) return "—";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

/**
 * Converte "DD/MM/AAAA" → "AAAA-MM-DD" (ou null se inválido).
 */
export function dataBRtoISO(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Extrai número e nome curto da fase.
 */
export function parseFase(fase: string): { num: string; nome: string } {
  const m = fase.match(/Fase\s+(\d+)\s*-\s*(.+)/);
  if (m) return { num: `F${m[1]}`, nome: m[2] };
  return { num: "", nome: fase };
}

/**
 * Cores associadas a cada status, para uso em UI.
 */
export const STATUS_COLORS: Record<StatusEfetivo, { bg: string; fg: string; bar: string }> = {
  "Não iniciada": { bg: "#f1efea", fg: "#5b5953", bar: "#b4b1a7" },
  "Em progresso": { bg: "#e0ecfa", fg: "#1d4d8a", bar: "#2e75b6" },
  "Em revisão":   { bg: "#fbf0d7", fg: "#8a5e0c", bar: "#d99b1f" },
  "Concluída":    { bg: "#d9f0df", fg: "#1f6f3e", bar: "#2f9b5b" },
  "Atrasada":     { bg: "#fcdcd6", fg: "#8c2c1b", bar: "#c64429" },
};

export const PRIORIDADE_COLORS: Record<Prioridade, { bg: string; fg: string }> = {
  Alta:  { bg: "#fde7e2", fg: "#8c2c1b" },
  Média: { bg: "#fbf0d7", fg: "#8a5e0c" },
  Baixa: { bg: "#e7eaf1", fg: "#4b4942" },
};
