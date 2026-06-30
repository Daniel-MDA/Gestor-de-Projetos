"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, FolderKanban, Check, Settings } from "lucide-react";
import Link from "next/link";
import { Projeto, PapelProjeto } from "@/lib/projetos";

type ProjetoComPapel = Projeto & { papel: PapelProjeto };

type Props = {
  projetos: ProjetoComPapel[];
  projetoAtualId: string;
};

export default function ProjectSelector({
  projetos,
  projetoAtualId,
}: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [aberto]);

  function trocarProjeto(id: string) {
    if (id === projetoAtualId) {
      setAberto(false);
      return;
    }
    setAberto(false);
    document.cookie = `projeto_atual=${id}; path=/; max-age=${60 * 60 * 24 * 90}`;
    router.refresh();
  }

  // Verifica se o usuário é admin no projeto atual
  const projetoAtual = projetos.find((p) => p.id === projetoAtualId);
  const ehAdminAtual = projetoAtual?.papel === "admin";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setAberto(!aberto)}
        className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md hover:bg-[#f1f2f7] transition-colors"
        title="Trocar projeto"
        aria-label="Trocar projeto"
      >
        <ChevronDown
          className={`w-4 h-4 text-[#8e8e9a] transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-[#e5e5ea] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#e5e5ea]">
            <div className="text-[9px] tracking-[0.12em] uppercase text-[#8e8e9a] font-mono">
              Trocar projeto
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto py-1">
            {projetos.map((p) => {
              const ativo = p.id === projetoAtualId;
              return (
                <button
                  key={p.id}
                  onClick={() => trocarProjeto(p.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                    ativo ? "bg-[#e6eef7]" : "hover:bg-[#ffffff]"
                  }`}
                >
                  <FolderKanban
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      ativo ? "text-[#0c0059]" : "text-[#8e8e9a]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        ativo ? "font-medium text-[#18182a]" : "text-[#4a4a5a]"
                      }`}
                    >
                      {p.nome}
                    </div>
                    <div className="text-[10px] text-[#8e8e9a] font-mono uppercase tracking-wide mt-0.5">
                      {p.papel}
                    </div>
                  </div>
                  {ativo && (
                    <Check className="w-3.5 h-3.5 text-[#0c0059] mt-1 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#e5e5ea] py-1">
            {ehAdminAtual && (
              <Link
                href={`/projetos/${projetoAtualId}/admin`}
                onClick={() => setAberto(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#4a4a5a] hover:bg-[#ffffff] transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Gerenciar este projeto
              </Link>
            )}
            <Link
              href="/projetos/novo"
              onClick={() => setAberto(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0c0059] hover:bg-[#e6eef7] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar novo projeto
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}