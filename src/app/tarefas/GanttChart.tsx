import {
  Tarefa,
  agruparPorFase,
  calcularStatsFase,
  parseFase,
  statusEfetivo,
} from "@/lib/tarefas";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtDataCurta(d: Date | null) {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function parseDateBR(d: string | null): Date | null {
  if (!d) return null;
  return new Date(d + "T00:00:00");
}

export default function GanttChart({ tarefas }: { tarefas: Tarefa[] }) {
  const fases = agruparPorFase(tarefas);

  // Calcula intervalo de datas
  const todasDatas: Date[] = [];
  for (const t of tarefas) {
    const ini = parseDateBR(t.data_inicio);
    const fim = parseDateBR(t.prazo);
    if (ini) todasDatas.push(ini);
    if (fim) todasDatas.push(fim);
  }

  if (todasDatas.length === 0) {
    return (
      <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 text-center text-sm text-[#8e8e9a]">
        Sem datas para exibir no Gantt.
      </div>
    );
  }

  const minDate = new Date(Math.min(...todasDatas.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...todasDatas.map((d) => d.getTime())));
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 3);
  const totalDays = daysBetween(minDate, maxDate);

  // Layout
  const labelWidth = 200;
  const rowHeight = 32;
  const headerHeight = 38;
  const padding = 16;
  const chartWidth = Math.max(800, totalDays * 7);
  const totalWidth = labelWidth + chartWidth + padding * 2;
  const totalHeight = headerHeight + fases.length * rowHeight + padding * 2;

  const xForDate = (d: Date) =>
    labelWidth + padding + (daysBetween(minDate, d) / totalDays) * chartWidth;

  // Marcadores de meses
  const months: Date[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cur <= maxDate) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Linha "hoje"
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeVisible = hoje >= minDate && hoje <= maxDate;

  return (
    <div className="bg-white border border-[#e5e5ea] rounded-xl p-4 overflow-x-auto">
      <div className="flex items-baseline gap-3 mb-3 px-1">
        <span className="text-[10px] tracking-[0.12em] uppercase text-[#8e8e9a] font-mono">
          01
        </span>
        <h2
          className="text-xl font-medium text-[#18182a] tracking-tight"
          style={{ fontFamily: "var(--font-bricolage), serif" }}
        >
          Linha do tempo
        </h2>
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width="100%"
        style={{ height: totalHeight, minWidth: 800 }}
      >
        {/* Linhas verticais de mês */}
        {months.map((m) => {
          const x = xForDate(m);
          if (x < labelWidth + padding || x > labelWidth + chartWidth + padding) return null;
          return (
            <g key={m.toISOString()}>
              <line
                x1={x}
                x2={x}
                y1={padding}
                y2={totalHeight - padding}
                stroke="#e5e5ea"
                strokeWidth={1}
              />
              <text
                x={x + 5}
                y={padding + 14}
                fontFamily="var(--font-jetbrains-mono), monospace"
                fontSize={10}
                fill="#8e8e9a"
              >
                {`${monthNames[m.getMonth()]} ${m.getFullYear()}`}
              </text>
            </g>
          );
        })}

        {/* Linha "hoje" */}
        {hojeVisible && (
          <g>
            <line
              x1={xForDate(hoje)}
              x2={xForDate(hoje)}
              y1={headerHeight}
              y2={totalHeight - padding}
              stroke="#c2410c"
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
            <text
              x={xForDate(hoje) + 4}
              y={headerHeight - 4}
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={9}
              fill="#c2410c"
            >
              hoje
            </text>
          </g>
        )}

        {/* Barras por fase */}
        {fases.map(({ fase, tarefas: ts }, i) => {
          const inicios = ts.map((t) => parseDateBR(t.data_inicio)).filter((d): d is Date => !!d);
          const prazos = ts.map((t) => parseDateBR(t.prazo)).filter((d): d is Date => !!d);
          if (inicios.length === 0 || prazos.length === 0) return null;

          const ini = new Date(Math.min(...inicios.map((d) => d.getTime())));
          const fim = new Date(Math.max(...prazos.map((d) => d.getTime())));
          const y = headerHeight + i * rowHeight + 4;
          const x1 = xForDate(ini);
          const x2 = xForDate(fim);
          const barW = Math.max(2, x2 - x1);
          const barH = rowHeight - 10;

          const stats = calcularStatsFase(ts);
          const pct = stats.pct / 100;
          const { nome } = parseFase(fase);

          // Cor da barra: verde se tudo concluído, vermelho se tem atrasada, azul senão
          const algumaAtrasada = ts.some((t) => statusEfetivo(t) === "Atrasada");
          const barColor = stats.todasConcluidas
            ? "#2f9b5b"
            : algumaAtrasada
            ? "#c64429"
            : "#2e75b6";
          const barLightBg = stats.todasConcluidas
            ? "#d9f0df"
            : algumaAtrasada
            ? "#fcdcd6"
            : "#e6eef7";

          return (
            <g key={fase}>
              <title>{`${nome}: ${stats.concluidas}/${stats.total} (${stats.pct}%)`}</title>
              {/* Label */}
              <text
                x={labelWidth + padding - 8}
                y={y + barH / 2 + 4}
                fontFamily="var(--font-manrope), sans-serif"
                fontSize={12}
                fontWeight={500}
                textAnchor="end"
                fill="#18182a"
              >
                {nome}
              </text>
              {/* Barra base */}
              <rect
                x={x1}
                y={y}
                width={barW}
                height={barH}
                rx={4}
                ry={4}
                fill={barLightBg}
                stroke={barColor}
                strokeWidth={0.8}
              />
              {/* Progresso */}
              {pct > 0 && (
                <rect
                  x={x1}
                  y={y}
                  width={barW * pct}
                  height={barH}
                  rx={4}
                  ry={4}
                  fill={barColor}
                />
              )}
              {/* Datas ao lado */}
              <text
                x={x2 + 6}
                y={y + barH / 2 + 3.5}
                fontFamily="var(--font-jetbrains-mono), monospace"
                fontSize={9}
                fill="#8e8e9a"
              >
                {`${fmtDataCurta(ini)} → ${fmtDataCurta(fim)}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
