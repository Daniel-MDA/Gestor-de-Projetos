import { Tarefa, statusEfetivo } from "@/lib/tarefas";

type SegmentInfo = {
  label: string;
  color: string;
  bg: string;
  count: number;
};

export default function StatusBar({ tarefas }: { tarefas: Tarefa[] }) {
  const total = tarefas.length;
  const efetivos = tarefas.map(statusEfetivo);

  const concluidas = efetivos.filter((s) => s === "Concluída").length;
  const emAndamento = efetivos.filter(
    (s) => s === "Em progresso" || s === "Em revisão"
  ).length;
  const atrasadas = efetivos.filter((s) => s === "Atrasada").length;
  const naoIniciadas = efetivos.filter((s) => s === "Não iniciada").length;

  const segments: SegmentInfo[] = [
    { label: "Concluídas",   color: "#1f6f3e", bg: "#2f9b5b", count: concluidas },
    { label: "Em andamento", color: "#1d4d8a", bg: "#2e75b6", count: emAndamento },
    { label: "Atrasadas",    color: "#8c2c1b", bg: "#c64429", count: atrasadas },
    { label: "Não iniciadas", color: "#5b5953", bg: "#b4b1a7", count: naoIniciadas },
  ];

  return (
    <div className="bg-white border border-[#e6e2d6] rounded-xl p-4">
      {/* Barra principal */}
      <div className="h-7 rounded-md overflow-hidden flex bg-[#f3f0e8]">
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={seg.label}
              className="h-full transition-all flex items-center justify-center"
              style={{
                width: `${pct}%`,
                background: seg.bg,
              }}
              title={`${seg.label}: ${seg.count} (${Math.round(pct)}%)`}
            >
              {pct >= 8 && (
                <span className="text-white text-[10px] font-mono font-medium tabular-nums">
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
          return (
            <div key={seg.label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ background: seg.bg }}
              />
              <span className="text-xs text-[#4b4942]">
                <span className="font-medium text-[#1a1815]">{seg.label}:</span>{" "}
                <span className="tabular-nums">{seg.count}</span>{" "}
                <span className="text-[#7c7a72]">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}