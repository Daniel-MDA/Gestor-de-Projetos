"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    router.push("/");
    router.refresh();
  }

  const RAIO = 26;
  const CIRCUMFERENCIA = 2 * Math.PI * RAIO;
  const offset = CIRCUMFERENCIA * (1 - progresso / 100);

  return (
    <header className="bg-white/85 backdrop-blur border-b border-[#e5e5ea] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Logo Tecnofink = botão para o início */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0"
            title="Ir para o início"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tecnofink-logo.png"
              alt="Tecnofink"
              className="h-6 w-auto"
            />
            <span className="text-[#d4d4da] text-xl leading-none">·</span>
          </Link>

          <div>
            <div className="text-[10px] tracking-[0.15em] uppercase text-[#8e8e9a] font-mono">
              Gestor de Tarefas
            </div>
            <div className="flex items-center gap-1">
              <h1
                className="text-2xl font-medium text-[#18182a] tracking-tight mt-0.5"
                style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
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
                stroke="#f1f2f7"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r={RAIO}
                fill="none"
                stroke="#0c0059"
                strokeWidth="6"
                strokeDasharray={CIRCUMFERENCIA}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-base font-medium text-[#18182a] tracking-tight tabular-nums"
                style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
              >
                {progresso}
                <span className="text-[9px] text-[#8e8e9a] ml-0.5">%</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] tracking-[0.12em] uppercase text-[#8e8e9a] font-mono">
              Logado como
            </div>
            <div className="text-sm text-[#18182a]">{userEmail}</div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="text-sm font-medium text-[#4a4a5a] hover:text-[#0c0059] border border-[#d4d4da] hover:border-[#0c0059] rounded-full px-4 py-2 transition-colors disabled:opacity-50"
            title="Sair"
          >
            {loading ? "Saindo…" : "Sair"}
          </button>
        </div>
      </div>
    </header>
  );
}
