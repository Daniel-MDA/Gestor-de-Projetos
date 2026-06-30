import {
  Tarefa,
  agruparPorFase,
  calcularStatsFase,
  fmtData,
  parseFase,
} from "@/lib/tarefas";

export default function PhasesRow({ tarefas }: { tarefas: Tarefa[] }) {
  const fases = agruparPorFase(tarefas);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {fases.map(({ fase, tarefas: ts }) => {
        const stats = calcularStatsFase(ts);
        const { num, nome } = parseFase(fase);
        const isComplete = stats.todasConcluidas;
        const isLate = !isComplete && stats.algumaAtrasada;

        return (
          <div
            key={fase}
            className={`
              relative bg-white border border-[#e5e5ea] rounded-xl px-4 py-3.5
              transition-all hover:-translate-y-0.5 hover:shadow-sm
              ${isComplete ? "bg-gradient-to-b from-white to-[#f0faf3]" : ""}
            `}
          >
            {/* Badge de completo/atrasado */}
            {isComplete && (
              <div className="absolute top-2.5 right-2.5 text-[#2f9b5b] text-xs font-bold">
                ✓
              </div>
            )}
            {isLate && (
              <div className="absolute top-2 right-2.5 w-[16px] h-[16px] rounded-full bg-[#fcdcd6] text-[#8c2c1b] flex items-center justify-center text-[10px] font-bold">
                !
              </div>
            )}

            {/* Cabeçalho com número e nome */}
            <div className="text-[10px] tracking-[0.1em] text-[#8e8e9a] font-mono">
              {num}
            </div>
            <div
              className="text-sm font-medium leading-tight text-[#18182a] mt-1 min-h-[2.6em]"
              style={{ fontFamily: "var(--font-bricolage), serif" }}
            >
              {nome}
            </div>

            {/* Data ocupando sua própria linha */}
            <div className="mt-4 pt-3 border-t border-[#f1f2f7]">
              <div className="text-[9px] tracking-[0.1em] uppercase text-[#8e8e9a] font-mono mb-1">
                Prazo final
              </div>
              <div className="text-base font-semibold tracking-tight text-[#18182a] tabular-nums">
                {fmtData(stats.prazoFinal)}
              </div>
            </div>

            {/* Progresso */}
            <div className="h-[4px] bg-[#f1f2f7] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-[#0c0059] transition-all"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#8e8e9a] font-mono mt-1.5 tabular-nums">
              <span>
                {stats.concluidas}/{stats.total}
              </span>
              <span>{stats.pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}