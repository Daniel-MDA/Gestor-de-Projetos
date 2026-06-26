"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Save,
  Loader2,
  Calendar,
  User,
  Tag,
  Flag,
  Plus,
} from "lucide-react";
import { PRIORIDADES, Prioridade, dataBRtoISO } from "@/lib/tarefas";
import { MembroAtribuicao, rotuloMembro } from "@/lib/responsavel";
import { criarTarefaAction } from "./criarTarefa";

type Props = {
  projetoId: string;
  fasesExistentes: string[];
  membros: MembroAtribuicao[];
  onClose: () => void;
  onCreated: (tarefaId: string) => void;
};

const NOVA_ETAPA = "__nova_etapa__";

export default function NewTaskModal({
  projetoId,
  fasesExistentes,
  membros,
  onClose,
  onCreated,
}: Props) {
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapaSelect, setEtapaSelect] = useState<string>(
    fasesExistentes[0] ?? NOVA_ETAPA
  );
  const [etapaNova, setEtapaNova] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("Média");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fecha com ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);

    const etapaFinal =
      etapaSelect === NOVA_ETAPA ? etapaNova.trim() : etapaSelect;

    if (!titulo.trim()) {
      setErro("Informe um título.");
      setSalvando(false);
      return;
    }
    if (!etapaFinal) {
      setErro("Informe uma etapa.");
      setSalvando(false);
      return;
    }
    if (!responsavelId) {
      setErro("Selecione um responsável.");
      setSalvando(false);
      return;
    }

    // Validação de datas (formato DD/MM/AAAA)
    let isoInicio: string | null = null;
    let isoPrazo: string | null = null;

    if (dataInicio) {
      isoInicio = dataBRtoISO(dataInicio);
      if (!isoInicio) {
        setErro("Data de início inválida. Use DD/MM/AAAA.");
        setSalvando(false);
        return;
      }
    }
    if (prazo) {
      isoPrazo = dataBRtoISO(prazo);
      if (!isoPrazo) {
        setErro("Prazo inválido. Use DD/MM/AAAA.");
        setSalvando(false);
        return;
      }
    }

    const r = await criarTarefaAction({
      projetoId,
      titulo,
      fase: etapaFinal,
      descricao: descricao || null,
      responsavel: responsavelId,
      dataInicio: isoInicio,
      prazo: isoPrazo,
      prioridade,
    });

    if (!r.ok) {
      setErro(r.erro);
      setSalvando(false);
      return;
    }

    router.refresh();
    onCreated(r.tarefaId);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-[#e6e2d6] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#e6eef7] flex items-center justify-center">
              <Plus className="w-5 h-5 text-[#1f4e79]" />
            </div>
            <div>
              <div className="text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] font-mono">
                Nova
              </div>
              <h2
                className="text-xl font-medium text-[#1a1815] tracking-tight"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                Adicionar tarefa
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f3f0e8] rounded-lg transition-colors"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5 text-[#4b4942]" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <Campo label="Título *">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              autoFocus
              placeholder="Ex.: Configurar webhooks do Bitrix"
              className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79]"
            />
          </Campo>

          <Campo label="Descrição (opcional)">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Detalhe a tarefa…"
              className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79] resize-none"
            />
          </Campo>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Etapa *" icon={<Tag className="w-3 h-3" />}>
              <select
                value={etapaSelect}
                onChange={(e) => setEtapaSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79]"
              >
                {fasesExistentes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value={NOVA_ETAPA}>+ Nova etapa…</option>
              </select>
              {etapaSelect === NOVA_ETAPA && (
                <input
                  type="text"
                  value={etapaNova}
                  onChange={(e) => setEtapaNova(e.target.value)}
                  placeholder="Ex.: Etapa 8 - Pós go-live"
                  className="w-full mt-2 px-3 py-2 text-sm bg-white border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79]"
                />
              )}
            </Campo>

            <Campo label="Responsável *" icon={<User className="w-3 h-3" />}>
              <select
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79]"
              >
                <option value="">Selecione um membro…</option>
                {membros.map((m) => (
                  <option key={m.usuario_id} value={m.usuario_id}>
                    {rotuloMembro(m)}
                  </option>
                ))}
              </select>
              {membros.length === 0 && (
                <div className="mt-1.5 text-[10px] text-[#7c7a72]">
                  Nenhum membro no projeto. Adicione membros em Gerenciar
                  projeto.
                </div>
              )}
            </Campo>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo
              label="Data de início (opcional)"
              icon={<Calendar className="w-3 h-3" />}
            >
              <input
                type="text"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79] tabular-nums"
              />
            </Campo>

            <Campo label="Prazo (opcional)" icon={<Calendar className="w-3 h-3" />}>
              <input
                type="text"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79] tabular-nums"
              />
            </Campo>
          </div>

          <Campo label="Prioridade" icon={<Flag className="w-3 h-3" />}>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as Prioridade)}
              className="w-full px-3 py-2 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79]"
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>

          <div className="text-xs text-[#7c7a72] bg-[#fbfaf6] border border-[#e6e2d6] rounded-lg px-3 py-2">
            A tarefa será criada com status <strong>Não iniciada</strong>. Para
            movê-la depois, arraste o card no kanban ou abra os detalhes.
          </div>

          {erro && (
            <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-4 py-2.5 rounded-lg">
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-[#e6e2d6] px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2 text-sm text-[#4b4942] hover:bg-[#f3f0e8] rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || membros.length === 0}
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
                Criar tarefa
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] mb-1.5 font-mono">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}