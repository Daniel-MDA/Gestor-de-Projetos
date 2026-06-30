"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Tarefa,
  STATUSES,
  STATUS_COLORS,
  PRIORIDADES,
  Prioridade,
  StatusEfetivo,
  dataBRtoISO,
  statusEfetivo,
} from "@/lib/tarefas";
import { PapelProjeto } from "@/lib/permissoes";
import {
  MembroAtribuicao,
  rotuloMembro,
  exibirResponsavel,
  ehUuid,
} from "@/lib/responsavel";
import {
  X,
  Save,
  Loader2,
  MessageSquare,
  Paperclip,
  Info,
  Tag,
  User,
  Calendar,
  Flag,
  Trash2,
} from "lucide-react";
import Comentarios from "./Comentarios";
import Anexos from "./Anexos";
import { excluirTarefaAction } from "./excluirTarefa";

// Statuses que o usuário pode escolher manualmente. "Atrasada" é automático
// (depende do prazo vencido) e não deve aparecer no select.
const STATUSES_SELECIONAVEIS: StatusEfetivo[] = STATUSES.filter(
  (s) => s !== "Atrasada"
);

// Converte "YYYY-MM-DD" → "DD/MM/AAAA" para exibir nos inputs.
function isoParaBR(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type Aba = "detalhes" | "comentarios" | "anexos";

type Props = {
  tarefa: Tarefa & { criado_por?: string | null };
  projetoId: string;
  papel: PapelProjeto | null;
  podeEditar: boolean;
  usuarioAtualId: string;
  membros: MembroAtribuicao[];
  onClose: () => void;
  onSaved: (atualizada: Tarefa) => void;
  onDeleted: (tarefaId: string) => void;
};

export default function TaskModal({
  tarefa,
  projetoId,
  papel,
  podeEditar,
  usuarioAtualId,
  membros,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [aba, setAba] = useState<Aba>("detalhes");

  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  const [etapa, setEtapa] = useState(tarefa.fase ?? "");
  const [responsavel, setResponsavel] = useState(tarefa.responsavel ?? "");
  const [dataInicio, setDataInicio] = useState(isoParaBR(tarefa.data_inicio));
  const [prazo, setPrazo] = useState(isoParaBR(tarefa.prazo));
  const [prioridade, setPrioridade] = useState<Prioridade>(tarefa.prioridade);
  const [status, setStatus] = useState<StatusEfetivo>(
    tarefa.status === "Atrasada" ? "Em progresso" : tarefa.status
  );

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Regras de exclusão: admin sempre, ou criador da tarefa.
  const podeExcluir =
    papel === "admin" ||
    (!!tarefa.criado_por && tarefa.criado_por === usuarioAtualId);

  // Fecha com ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !salvando && !excluindo) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, salvando, excluindo]);

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);

    if (!titulo.trim()) {
      setErro("Título não pode ficar vazio.");
      setSalvando(false);
      return;
    }
    if (!etapa.trim()) {
      setErro("Etapa não pode ficar vazia.");
      setSalvando(false);
      return;
    }
    if (!responsavel.trim()) {
      setErro("Responsável é obrigatório.");
      setSalvando(false);
      return;
    }

    let isoInicio: string | null = null;
    let isoPrazo: string | null = null;

    if (dataInicio.trim()) {
      isoInicio = dataBRtoISO(dataInicio);
      if (!isoInicio) {
        setErro("Data de início inválida. Use DD/MM/AAAA.");
        setSalvando(false);
        return;
      }
    }
    if (prazo.trim()) {
      isoPrazo = dataBRtoISO(prazo);
      if (!isoPrazo) {
        setErro("Prazo inválido. Use DD/MM/AAAA.");
        setSalvando(false);
        return;
      }
    }

    const supabase = createClient();
    const novaDataConclusao =
      status === "Concluída"
        ? tarefa.data_conclusao ?? new Date().toISOString().slice(0, 10)
        : null;

    const { data, error } = await supabase
      .from("tarefas")
      .update({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        fase: etapa.trim(),
        responsavel: responsavel.trim(),
        data_inicio: isoInicio,
        prazo: isoPrazo,
        prioridade,
        status,
        data_conclusao: novaDataConclusao,
      })
      .eq("id", tarefa.id)
      .select("*")
      .single();

    if (error) {
      setErro("Erro ao salvar: " + error.message);
      setSalvando(false);
      return;
    }

    onSaved(data as Tarefa);
  }

  async function handleExcluir() {
    const confirmar = confirm(
      `Excluir ${tarefa.codigo}? Esta ação não pode ser desfeita.`
    );
    if (!confirmar) return;

    setExcluindo(true);
    setErro(null);

    const r = await excluirTarefaAction(tarefa.id);

    if (!r.ok) {
      setErro(r.erro);
      setExcluindo(false);
      return;
    }

    onDeleted(tarefa.id);
  }

  const statusEf = statusEfetivo(tarefa);
  const cores = STATUS_COLORS[statusEf];

  const respIsUuid = ehUuid(responsavel);
  const respMembroExiste =
    respIsUuid && membros.some((m) => m.usuario_id === responsavel.trim());

  const desabilitarFechar = salvando || excluindo;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => !desabilitarFechar && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-[#e5e5ea] px-6 py-4 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                style={{ background: cores.bar, color: "white" }}
              >
                {statusEf}
              </span>
              <span className="text-xs text-[#8e8e9a] font-mono shrink-0">
                {tarefa.codigo}
              </span>
              <h2
                className="text-lg font-medium text-[#18182a] tracking-tight truncate"
                style={{ fontFamily: "var(--font-bricolage), serif" }}
                title={tarefa.titulo}
              >
                {tarefa.titulo}
              </h2>
            </div>
            <button
              onClick={() => !desabilitarFechar && onClose()}
              disabled={desabilitarFechar}
              className="p-2 hover:bg-[#f1f2f7] rounded-lg transition-colors shrink-0"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5 text-[#4a4a5a]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 -mb-px">
            <TabBtn
              ativa={aba === "detalhes"}
              onClick={() => setAba("detalhes")}
              icon={<Info className="w-3.5 h-3.5" />}
            >
              Detalhes
            </TabBtn>
            <TabBtn
              ativa={aba === "comentarios"}
              onClick={() => setAba("comentarios")}
              icon={<MessageSquare className="w-3.5 h-3.5" />}
            >
              Comentários
            </TabBtn>
            <TabBtn
              ativa={aba === "anexos"}
              onClick={() => setAba("anexos")}
              icon={<Paperclip className="w-3.5 h-3.5" />}
            >
              Anexos
            </TabBtn>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {aba === "detalhes" && (
            <div className="space-y-5">
              <Campo label="Título *">
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  disabled={!podeEditar}
                  className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60"
                />
              </Campo>

              <Campo label="Descrição">
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  disabled={!podeEditar}
                  rows={4}
                  className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60 resize-none"
                />
              </Campo>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Etapa *" icon={<Tag className="w-3 h-3" />}>
                  <input
                    type="text"
                    value={etapa}
                    onChange={(e) => setEtapa(e.target.value)}
                    disabled={!podeEditar}
                    className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60"
                  />
                </Campo>

                <Campo
                  label="Responsável *"
                  icon={<User className="w-3 h-3" />}
                >
                  <select
                    value={respMembroExiste ? responsavel : ""}
                    onChange={(e) => setResponsavel(e.target.value)}
                    disabled={!podeEditar}
                    className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60"
                  >
                    <option value="">Selecione…</option>
                    {membros.map((m) => (
                      <option key={m.usuario_id} value={m.usuario_id}>
                        {rotuloMembro(m)}
                      </option>
                    ))}
                  </select>
                  {!respMembroExiste && responsavel && (
                    <div className="mt-1.5 text-[10px] text-[#8a5e0c] bg-[#fbf0d7] border border-[#d99b1f]/30 rounded px-2 py-1">
                      Valor antigo:{" "}
                      <strong>{exibirResponsavel(responsavel, membros)}</strong>.
                      Selecione um membro acima para atualizar.
                    </div>
                  )}
                </Campo>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Campo
                  label="Data de início"
                  icon={<Calendar className="w-3 h-3" />}
                >
                  <input
                    type="text"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    disabled={!podeEditar}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60 tabular-nums"
                  />
                </Campo>

                <Campo label="Prazo" icon={<Calendar className="w-3 h-3" />}>
                  <input
                    type="text"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    disabled={!podeEditar}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60 tabular-nums"
                  />
                </Campo>

                <Campo label="Prioridade" icon={<Flag className="w-3 h-3" />}>
                  <select
                    value={prioridade}
                    onChange={(e) =>
                      setPrioridade(e.target.value as Prioridade)
                    }
                    disabled={!podeEditar}
                    className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60"
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>

              <Campo label="Status">
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as StatusEfetivo)
                  }
                  disabled={!podeEditar}
                  className="w-full px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059] disabled:opacity-60"
                >
                  {STATUSES_SELECIONAVEIS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[10px] text-[#8e8e9a]">
                  &quot;Atrasada&quot; é calculada automaticamente quando o prazo
                  vence.
                </div>
              </Campo>

              {tarefa.data_conclusao && (
                <div className="text-xs text-[#8e8e9a]">
                  Concluída em{" "}
                  {new Date(tarefa.data_conclusao).toLocaleDateString("pt-BR")}
                </div>
              )}

              {erro && (
                <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-4 py-2.5 rounded-lg">
                  {erro}
                </div>
              )}
            </div>
          )}

          {aba === "comentarios" && (
            <Comentarios
              tarefaId={tarefa.id}
              papel={papel}
              podeEditar={podeEditar}
              usuarioAtualId={usuarioAtualId}
            />
          )}

          {aba === "anexos" && (
            <Anexos
              tarefaId={tarefa.id}
              projetoId={projetoId}
              papel={papel}
              podeEditar={podeEditar}
              usuarioAtualId={usuarioAtualId}
            />
          )}
        </div>

        {/* Footer (só na aba detalhes) */}
        {aba === "detalhes" && podeEditar && (
          <div className="bg-white border-t border-[#e5e5ea] px-6 py-4 flex justify-between items-center gap-2 rounded-b-2xl">
            <div>
              {podeExcluir && (
                <button
                  onClick={handleExcluir}
                  disabled={salvando || excluindo}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#c64429] hover:bg-[#fcdcd6] hover:text-[#8c2c1b] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Excluir tarefa"
                >
                  {excluindo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Excluindo…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => !desabilitarFechar && onClose()}
                disabled={desabilitarFechar}
                className="px-4 py-2 text-sm text-[#4a4a5a] hover:bg-[#f1f2f7] rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando || excluindo}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#18182a] hover:bg-[#0c0059] disabled:bg-[#8e8e9a] text-white rounded-lg transition-colors"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  ativa,
  onClick,
  icon,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
        ativa
          ? "border-[#0c0059] text-[#0c0059]"
          : "border-transparent text-[#8e8e9a] hover:text-[#18182a] hover:bg-[#f1f2f7]"
      }`}
    >
      {icon}
      {children}
    </button>
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
      <label className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-[#8e8e9a] mb-1.5 font-mono">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}