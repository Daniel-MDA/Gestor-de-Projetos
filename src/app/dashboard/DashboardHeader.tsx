"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Tarefa, calcularKPIs } from "@/lib/tarefas";
import ProjectSelector from "./ProjectSelector";
import { Projeto, PapelProjeto } from "@/lib/projetos";

type ProjetoComPapel = Projeto & { papel: PapelProjeto };

type Props = {
  userEmail: string;
  projetoNome: string;
  projetoId: string;
  todosProjetos: ProjetoComPapel[];
  tarefas: Tarefa[];
};

export default function DashboardHeader({
  userEmail,
  projetoNome,
  projetoId,
  todosProjetos,
  tarefas,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { progresso, concluidas, total } = calcularKPIs(tarefas);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const RAIO = 26;
  const CIRCUMFERENCIA = 2 * Math.PI * RAIO;
  const offset = CIRCUMFERENCIA * (1 - progresso / 100);

  return (
    <header className="bg-white border-b border-[#e6e2d6]">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div>
            <div className="text-[10px] tracking-[0.15em] uppercase text-[#7c7a72] font-mono">
              Tecnofink · Projeto interno
            </div>
            <div className="flex items-center gap-1">
              <h1
                className="text-2xl font-medium text-[#1a1815] tracking-tight mt-0.5"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                {projetoNome}
              </h1>
              <ProjectSelector
                projetos={todosProjetos}
                projetoAtualId={projetoId}
              />
            </div>
          </div>

          <div
            className="relative w-[64px] h-[64px]"
            title={`${concluidas} de ${total} concluídas`}
          >
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle
                cx="32"
                cy="32"
                r={RAIO}
                fill="none"
                stroke="#f3f0e8"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r={RAIO}
                fill="none"
                stroke="#1f4e79"
                strokeWidth="6"
                strokeDasharray={CIRCUMFERENCIA}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-base font-medium text-[#1a1815] tracking-tight tabular-nums"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                {progresso}
                <span className="text-[9px] text-[#7c7a72] ml-0.5">%</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] font-mono">
              Logado como
            </div>
            <div className="text-sm text-[#1a1815]">{userEmail}</div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#4b4942] hover:bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg transition-colors disabled:opacity-50"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}