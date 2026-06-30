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
    <main className="min-h-screen bg-[#f8f9fc] py-10 px-6">
      <div className="max-w-xl mx-auto">
        <Link
          href="/tarefas"
          className="inline-flex items-center gap-1.5 text-sm text-[#8e8e9a] hover:text-[#18182a] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar às tarefas
        </Link>

        <div className="bg-white border border-[#e5e5ea] rounded-2xl p-8">
          <div className="mb-6">
            <div className="text-[10px] tracking-[0.15em] uppercase text-[#8e8e9a] font-mono mb-1">
              Tecnofink CRM
            </div>
            <h1
              className="text-3xl font-medium text-[#18182a] tracking-tight"
              style={{ fontFamily: "var(--font-bricolage), serif" }}
            >
              Criar <em className="italic text-[#0c0059]">novo projeto</em>
            </h1>
            <p className="text-sm text-[#8e8e9a] mt-2">
              Você ficará como administrador automaticamente e poderá convidar
              outras pessoas depois.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="nome"
                className="block text-[10px] tracking-[0.12em] uppercase text-[#8e8e9a] mb-1.5 font-mono"
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
                className="w-full px-3 py-2.5 bg-[#ffffff] border border-[#d4d4da] rounded-lg text-sm text-[#18182a] outline-none focus:border-[#0c0059] transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="descricao"
                className="block text-[10px] tracking-[0.12em] uppercase text-[#8e8e9a] mb-1.5 font-mono"
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
                className="w-full px-3 py-2.5 bg-[#ffffff] border border-[#d4d4da] rounded-lg text-sm text-[#18182a] outline-none focus:border-[#0c0059] transition-colors resize-none"
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
                className="px-4 py-2 text-sm text-[#4a4a5a] hover:bg-[#f1f2f7] rounded-lg transition-colors"
              >
                Cancelar
              </Link>
              <button
                onClick={handleCriar}
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#18182a] hover:bg-[#0c0059] disabled:bg-[#8e8e9a] text-white rounded-lg transition-colors"
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
