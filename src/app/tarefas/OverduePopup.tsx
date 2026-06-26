"use client";

import { useState, useEffect } from "react";
import { Tarefa, statusEfetivo, fmtData, parseFase } from "@/lib/tarefas";
import { AlertCircle, X } from "lucide-react";

type Props = {
  tarefas: Tarefa[];
  projetoId: string;
};

const STORAGE_KEY_BASE = "tecnofink_overdue_shown";

function chaveDoDia(projetoId: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  return `${STORAGE_KEY_BASE}_${projetoId}_${hoje}`;
}

export default function OverduePopup({ tarefas, projetoId }: Props) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    // Confere se já foi mostrado hoje pra este projeto
    const chave = chaveDoDia(projetoId);
    if (typeof window !== "undefined" && localStorage.getItem(chave)) return;

    const atrasadas = tarefas.filter((t) => statusEfetivo(t) === "Atrasada");
    if (atrasadas.length > 0) {
      // Pequeno delay pro popup não aparecer "junto" da tela carregando
      const timer = setTimeout(() => setAberto(true), 600);
      return () => clearTimeout(timer);
    }
  }, [tarefas, projetoId]);

  function fechar() {
    setAberto(false);
  }

  function fecharENaoMostrarHoje() {
    if (typeof window !== "undefined") {
      localStorage.setItem(chaveDoDia(projetoId), "1");
    }
    setAberto(false);
  }

  const atrasadas = tarefas.filter((t) => statusEfetivo(t) === "Atrasada");
  if (!aberto || atrasadas.length === 0) return null;

  // Ordena por prazo (mais antigas primeiro)
  const ordenadas = [...atrasadas].sort((a, b) =>
    (a.prazo ?? "").localeCompare(b.prazo ?? "")
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={fechar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#e6e2d6]">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[#fcdcd6] flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-[#c64429]" />
              </div>
              <div>
                <div className="text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] font-mono">
                  Atenção
                </div>
                <h2
                  className="text-xl font-medium text-[#1a1815] tracking-tight"
                  style={{ fontFamily: "var(--font-fraunces), serif" }}
                >
                  {atrasadas.length}{" "}
                  {atrasadas.length === 1
                    ? "tarefa atrasada"
                    : "tarefas atrasadas"}
                </h2>
              </div>
            </div>
            <button
              onClick={fechar}
              className="p-2 hover:bg-[#f3f0e8] rounded-lg transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5 text-[#4b4942]" />
            </button>
          </div>
          <p className="text-sm text-[#7c7a72] mt-2">
            As tarefas abaixo estão com prazo vencido. Considere atualizar o
            status ou ajustar prazos.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {ordenadas.map((t) => {
            const { num } = parseFase(t.fase);
            return (
              <div
                key={t.id}
                className="flex items-start gap-3 p-2.5 bg-[#fcdcd6]/40 border border-[#fcdcd6] rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-[#8c2c1b] font-mono">
                      {t.codigo} · {num}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-[#1a1815] mt-0.5">
                    {t.titulo}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[#7c7a72] font-mono uppercase tracking-wide">
                    Prazo
                  </div>
                  <div className="text-sm font-semibold text-[#8c2c1b] tabular-nums">
                    {fmtData(t.prazo)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-[#e6e2d6] flex justify-end gap-2">
          <button
            onClick={fecharENaoMostrarHoje}
            className="px-4 py-2 text-sm text-[#4b4942] hover:bg-[#f3f0e8] rounded-lg transition-colors"
          >
            Não mostrar de novo hoje
          </button>
          <button
            onClick={fechar}
            className="px-4 py-2 text-sm bg-[#1a1815] hover:bg-[#1f4e79] text-white rounded-lg transition-colors"
          >
            Ver tarefas
          </button>
        </div>
      </div>
    </div>
  );
}
