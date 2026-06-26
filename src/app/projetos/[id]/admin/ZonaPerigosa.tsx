"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import {
  arquivarProjetoAction,
  excluirProjetoAction,
} from "./acoesZonaPerigosa";

type Props = {
  projetoId: string;
  projetoNome: string;
};

export default function ZonaPerigosa({ projetoId, projetoNome }: Props) {
  const router = useRouter();

  const [modal, setModal] = useState<"arquivar" | "excluir" | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeDigitado, setNomeDigitado] = useState("");

  async function executarArquivar() {
    setCarregando(true);
    setErro(null);

    const r = await arquivarProjetoAction(projetoId);

    if (!r.ok) {
      setErro(r.erro);
      setCarregando(false);
      return;
    }

    // Sucesso → fora do projeto. Redireciona pro dashboard.
    router.push("/tarefas");
    router.refresh();
  }

  async function executarExcluir() {
    setCarregando(true);
    setErro(null);

    const r = await excluirProjetoAction(projetoId, nomeDigitado);

    if (!r.ok) {
      setErro(r.erro);
      setCarregando(false);
      return;
    }

    router.push("/tarefas");
    router.refresh();
  }

  function fecharModal() {
    if (carregando) return;
    setModal(null);
    setErro(null);
    setNomeDigitado("");
  }

  return (
    <>
      {/* Card da zona perigosa */}
      <div className="bg-white border border-[#f3c8be] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#fcdcd6] bg-[#fcdcd6]/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#8c2c1b]" />
          <h2
            className="text-base font-medium text-[#8c2c1b]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            Zona perigosa
          </h2>
        </div>

        {/* Arquivar */}
        <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-[#f3c8be]">
          <div className="flex-1">
            <div className="text-sm font-medium text-[#1a1815] mb-0.5">
              Arquivar projeto
            </div>
            <div className="text-xs text-[#7c7a72]">
              O projeto fica oculto do dashboard mas os dados permanecem no banco.
              Pode ser desarquivado depois pelo painel do Supabase.
            </div>
          </div>
          <button
            onClick={() => setModal("arquivar")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8a5e0c] hover:bg-[#fbf0d7] border border-[#d99b1f]/50 rounded-lg transition-colors shrink-0"
          >
            <Archive className="w-4 h-4" />
            Arquivar
          </button>
        </div>

        {/* Excluir */}
        <div className="px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm font-medium text-[#1a1815] mb-0.5">
              Excluir permanentemente
            </div>
            <div className="text-xs text-[#7c7a72]">
              Remove o projeto, todas as tarefas, comentários e anexos. Esta ação
              não pode ser desfeita.
            </div>
          </div>
          <button
            onClick={() => setModal("excluir")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-[#c64429] hover:bg-[#8c2c1b] rounded-lg transition-colors shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
        </div>
      </div>

      {/* Modal de arquivamento */}
      {modal === "arquivar" && (
        <Modal onClose={fecharModal}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#8a5e0c]" />
              <h3
                className="text-lg font-medium text-[#1a1815]"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                Arquivar projeto
              </h3>
            </div>
            <button
              onClick={fecharModal}
              disabled={carregando}
              className="p-1 text-[#4b4942] hover:bg-[#f3f0e8] rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-[#4b4942] mb-2">
            O projeto{" "}
            <strong className="text-[#1a1815]">{projetoNome}</strong> ficará
            oculto do dashboard.
          </p>
          <p className="text-xs text-[#7c7a72] mb-5">
            Os dados ficam preservados e podem ser restaurados depois pelo painel
            do Supabase.
          </p>

          {erro && (
            <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-3 py-2 rounded-lg mb-4">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={fecharModal}
              disabled={carregando}
              className="px-4 py-2 text-sm text-[#4b4942] hover:bg-[#f3f0e8] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={executarArquivar}
              disabled={carregando}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#d99b1f] hover:bg-[#8a5e0c] disabled:bg-[#7c7a72] text-white rounded-lg transition-colors"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Arquivando…
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Arquivar
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de exclusão */}
      {modal === "excluir" && (
        <Modal onClose={fecharModal}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#c64429]" />
              <h3
                className="text-lg font-medium text-[#1a1815]"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                Excluir permanentemente
              </h3>
            </div>
            <button
              onClick={fecharModal}
              disabled={carregando}
              className="p-1 text-[#4b4942] hover:bg-[#f3f0e8] rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-[#4b4942] mb-3">
            Esta ação <strong>não pode ser desfeita</strong>. Serão excluídos:
          </p>
          <ul className="text-xs text-[#7c7a72] mb-4 space-y-0.5 pl-4 list-disc">
            <li>O projeto e todas as suas tarefas</li>
            <li>Todos os comentários nas tarefas</li>
            <li>Todos os anexos (incluindo arquivos no Storage)</li>
            <li>A lista de membros do projeto</li>
          </ul>

          <div className="mb-4">
            <label className="block text-xs text-[#4b4942] mb-1.5">
              Para confirmar, digite{" "}
              <strong className="text-[#1a1815] font-mono">{projetoNome}</strong>{" "}
              abaixo:
            </label>
            <input
              type="text"
              value={nomeDigitado}
              onChange={(e) => setNomeDigitado(e.target.value)}
              disabled={carregando}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#c64429]"
            />
          </div>

          {erro && (
            <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-3 py-2 rounded-lg mb-4">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={fecharModal}
              disabled={carregando}
              className="px-4 py-2 text-sm text-[#4b4942] hover:bg-[#f3f0e8] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={executarExcluir}
              disabled={carregando || nomeDigitado.trim() !== projetoNome}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#c64429] hover:bg-[#8c2c1b] disabled:bg-[#7c7a72] disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Excluir permanentemente
                </>
              )}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// =============================================================================
// Modal wrapper
// =============================================================================
function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}