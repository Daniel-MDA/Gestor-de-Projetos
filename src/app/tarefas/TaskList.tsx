"use client";

import { CheckCircle2, Circle, Clock, AlertCircle, RotateCw } from "lucide-react";
import { Tarefa, statusEfetivo, fmtData } from "@/lib/tarefas";

const statusConfig = {
  "Não iniciada": { icon: Circle, color: "#8e8e9a", bg: "#f1efea" },
  "Em progresso": { icon: RotateCw, color: "#1d4d8a", bg: "#e0ecfa" },
  "Em revisão":   { icon: Clock, color: "#8a5e0c", bg: "#fbf0d7" },
  "Concluída":    { icon: CheckCircle2, color: "#1f6f3e", bg: "#d9f0df" },
  "Atrasada":     { icon: AlertCircle, color: "#8c2c1b", bg: "#fcdcd6" },
};

const prioridadeConfig = {
  Alta:  { color: "#8c2c1b", bg: "#fde7e2" },
  Média: { color: "#8a5e0c", bg: "#fbf0d7" },
  Baixa: { color: "#4a4a5a", bg: "#e7eaf1" },
};

type Props = {
  tarefas: Tarefa[];
  onTaskClick?: (tarefa: Tarefa) => void;
};

export default function TaskList({ tarefas, onTaskClick }: Props) {
  const clicavel = !!onTaskClick;

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-medium text-[#18182a] tracking-tight"
          style={{ fontFamily: "var(--font-bricolage), serif" }}
        >
          Tarefas <em className="italic text-[#0c0059]">do projeto</em>
        </h2>
        <p className="text-sm text-[#8e8e9a] mt-1">
          {tarefas.length}{" "}
          {tarefas.length === 1 ? "tarefa" : "tarefas"} carregada(s) do banco
          {clicavel && (
            <span className="ml-2 text-[#8e8e9a]">
              · clique em uma linha para ver detalhes
            </span>
          )}
        </p>
      </div>

      <div className="bg-white border border-[#e5e5ea] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#ffffff] border-b border-[#e5e5ea]">
            <tr>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.08em] uppercase text-[#8e8e9a] font-mono font-medium">
                Código
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.08em] uppercase text-[#8e8e9a] font-mono font-medium">
                Tarefa
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.08em] uppercase text-[#8e8e9a] font-mono font-medium">
                Etapa
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.08em] uppercase text-[#8e8e9a] font-mono font-medium">
                Prazo
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.08em] uppercase text-[#8e8e9a] font-mono font-medium">
                Prioridade
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.08em] uppercase text-[#8e8e9a] font-mono font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => {
              const stEf = statusEfetivo(t);
              const st = statusConfig[stEf];
              const pr = prioridadeConfig[t.prioridade];
              const StatusIcon = st.icon;
              return (
                <tr
                  key={t.id}
                  onClick={() => onTaskClick?.(t)}
                  className={`border-b border-[#e5e5ea] last:border-b-0 hover:bg-[#ffffff] transition-colors ${
                    clicavel ? "cursor-pointer" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#8e8e9a]">
                    {t.codigo}
                  </td>
                  <td className="px-4 py-3 text-[#18182a] font-medium">
                    {t.titulo}
                  </td>
                  <td className="px-4 py-3 text-[#4a4a5a]">{t.fase}</td>
                  <td className="px-4 py-3 text-[#4a4a5a]">{fmtData(t.prazo)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider"
                      style={{ background: pr.bg, color: pr.color }}
                    >
                      {t.prioridade}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: st.bg, color: st.color }}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {stEf}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}