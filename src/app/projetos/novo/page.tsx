"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { criarProjetoAction } from "./actions";

export default function NovoProjetoPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleCriar() {
    setSalvando(true);
    setErro(null);

    const resultado = await criarProjetoAction(nome, descricao || null);

    if (!resultado.ok) {
      setErro(resultado.erro);
      setSalvando(false);
      return;
    }

    router.push("/tarefas");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1] py-10 px-6">
      <div className="max-w-xl mx-auto">
        <Link
          href="/tarefas"
          className="inline-flex items-center gap-1.5 text-sm text-[#7c7a72] hover:text-[#1a1815] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar às tarefas
        </Link>

        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-8">
          <div className="mb-6">
            <div className="text-[10px] tracking-[0.15em] uppercase text-[#7c7a72] font-mono mb-1">
              Tecnofink CRM
            </div>
            <h1
              className="text-3xl font-medium text-[#1a1815] tracking-tight"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Criar <em className="italic text-[#1f4e79]">novo projeto</em>
            </h1>
            <p className="text-sm text-[#7c7a72] mt-2">
              Você ficará como administrador automaticamente e poderá convidar
              outras pessoas depois.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="nome"
                className="block text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] mb-1.5 font-mono"
              >
                Nome do projeto
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={salvando}
                placeholder="Ex.: Migração de ERP"
                className="w-full px-3 py-2.5 bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg text-sm text-[#1a1815] outline-none focus:border-[#1f4e79] transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="descricao"
                className="block text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] mb-1.5 font-mono"
              >
                Descrição (opcional)
              </label>
              <textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={salvando}
                rows={3}
                placeholder="Contexto, objetivo, escopo geral…"
                className="w-full px-3 py-2.5 bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg text-sm text-[#1a1815] outline-none focus:border-[#1f4e79] transition-colors resize-none"
              />
            </div>

            {erro && (
              <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-3 py-2.5 rounded-lg">
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Link
                href="/tarefas"
                className="px-4 py-2 text-sm text-[#4b4942] hover:bg-[#f3f0e8] rounded-lg transition-colors"
              >
                Cancelar
              </Link>
              <button
                onClick={handleCriar}
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1a1815] hover:bg-[#1f4e79] disabled:bg-[#7c7a72] text-white rounded-lg transition-colors"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Criar projeto
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
