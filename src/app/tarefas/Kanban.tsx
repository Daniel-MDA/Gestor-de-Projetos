"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Tarefa,
  STATUSES,
  STATUS_COLORS,
  PRIORIDADE_COLORS,
  agruparPorStatus,
  statusEfetivo,
  parseFase,
  fmtData,
  StatusEfetivo,
} from "@/lib/tarefas";
import { useTarefasRealtime } from "@/lib/realtime";
import { PapelProjeto, podeEditar } from "@/lib/permissoes";
import { MembroAtribuicao, exibirResponsavel } from "@/lib/responsavel";
import { Undo2, X, Plus, LayoutList, Layers } from "lucide-react";
import NewTaskModal from "./NewTaskModal";

type Props = {
  tarefas: Tarefa[];
  setTarefas: React.Dispatch<React.SetStateAction<Tarefa[]>>;
  projetoId: string;
  papel: PapelProjeto | null;
  usuarioAtualId: string;
  membros: MembroAtribuicao[];
  onTaskClick: (tarefa: Tarefa) => void;
};

type ModoVisualizacao = "status" | "etapa";

const ITEMS_POR_COLUNA = 10;
const LS_VIEW_KEY = "kanban_view_mode";

type Coluna = {
  id: string;
  label: string;
  badge?: string;
  desabilitada: boolean;
};

const CORES_ETAPA = {
  bg: "#ffffff",
  bar: "#8e8e9a",
  fg: "#4a4a5a",
  bgDragOver: "#e5e5ea",
};

type UndoStatus = {
  tipo: "status";
  id: string;
  statusAnterior: StatusEfetivo;
  dataConclusaoAnterior: string | null;
  timeoutId: NodeJS.Timeout;
};

type UndoEtapa = {
  tipo: "etapa";
  id: string;
  etapaAnterior: string;
  timeoutId: NodeJS.Timeout;
};

type UndoInfo = UndoStatus | UndoEtapa;

export default function Kanban({
  tarefas,
  setTarefas,
  projetoId,
  papel,
  usuarioAtualId,
  membros,
  onTaskClick,
}: Props) {
  const [modo, setModo] = useState<ModoVisualizacao>("status");

  useEffect(() => {
    const salvo = localStorage.getItem(LS_VIEW_KEY);
    if (salvo === "etapa" || salvo === "status") setModo(salvo);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_VIEW_KEY, modo);
  }, [modo]);

  const [colunasExpandidas, setColunasExpandidas] = useState<Set<string>>(new Set());
  const [novaAberta, setNovaAberta] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColuna, setDragOverColuna] = useState<string | null>(null);
  const [undoInfo, setUndoInfo] = useState<UndoInfo | null>(null);

  // Refs e estado para a scrollbar superior sincronizada
  const trilhoSuperiorRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const [larguraConteudo, setLarguraConteudo] = useState(0);
  // Flag para evitar loop de eventos quando um sync chama o outro
  const sincronizandoRef = useRef(false);

  const podeEdit = podeEditar(papel);

  useEffect(() => {
    setColunasExpandidas(new Set());
  }, [modo]);

  useTarefasRealtime(projetoId, {
    onUpdate: (t) => {
      setTarefas((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    },
    onInsert: (t) => {
      setTarefas((prev) => {
        if (prev.find((x) => x.id === t.id)) return prev;
        return [...prev, t];
      });
    },
    onDelete: (id) => {
      setTarefas((prev) => prev.filter((x) => x.id !== id));
    },
  });

  // ---------------------------------------------------------------------------
  // Colunas e grupos por modo
  // ---------------------------------------------------------------------------
  const { colunas, grupos } = useMemo(() => {
    if (modo === "status") {
      const cols: Coluna[] = STATUSES.map((s) => ({
        id: s,
        label: s,
        desabilitada: s === "Atrasada",
      }));
      const g = agruparPorStatus(tarefas);
      const map = new Map<string, Tarefa[]>();
      cols.forEach((c) => map.set(c.id, g.get(c.id as StatusEfetivo) ?? []));
      return { colunas: cols, grupos: map };
    } else {
      const etapasUnicas = Array.from(
        new Set(tarefas.map((t) => t.fase).filter(Boolean))
      ).sort();
      const cols: Coluna[] = etapasUnicas.map((e) => {
        const { num, nome } = parseFase(e);
        return {
          id: e,
          label: nome,
          badge: num || undefined,
          desabilitada: false,
        };
      });
      const map = new Map<string, Tarefa[]>();
      for (const e of etapasUnicas) map.set(e, []);
      for (const t of tarefas) {
        if (t.fase) {
          if (!map.has(t.fase)) map.set(t.fase, []);
          map.get(t.fase)!.push(t);
        }
      }
      return { colunas: cols, grupos: map };
    }
  }, [modo, tarefas]);

  const etapasExistentes = Array.from(
    new Set(tarefas.map((t) => t.fase).filter(Boolean))
  ).sort();

  // ---------------------------------------------------------------------------
  // Sincronização das duas barras de scroll (superior espelha o grid)
  // ---------------------------------------------------------------------------
  // Mede largura do conteúdo e atualiza largura virtual do trilho superior
  useEffect(() => {
    if (modo !== "etapa") return;
    const conteudo = conteudoRef.current;
    if (!conteudo) return;

    const atualizar = () => {
      setLarguraConteudo(conteudo.scrollWidth);
    };
    atualizar();

    const ro = new ResizeObserver(atualizar);
    ro.observe(conteudo);
    return () => ro.disconnect();
  }, [modo, colunas.length]);

  function handleScrollSuperior(e: React.UIEvent<HTMLDivElement>) {
    if (sincronizandoRef.current) {
      sincronizandoRef.current = false;
      return;
    }
    const conteudo = conteudoRef.current;
    if (!conteudo) return;
    sincronizandoRef.current = true;
    conteudo.scrollLeft = (e.target as HTMLDivElement).scrollLeft;
  }

  function handleScrollConteudo(e: React.UIEvent<HTMLDivElement>) {
    if (sincronizandoRef.current) {
      sincronizandoRef.current = false;
      return;
    }
    const trilho = trilhoSuperiorRef.current;
    if (!trilho) return;
    sincronizandoRef.current = true;
    trilho.scrollLeft = (e.target as HTMLDivElement).scrollLeft;
  }

  // ---------------------------------------------------------------------------
  // Mover por status
  // ---------------------------------------------------------------------------
  async function moverPorStatus(tarefaId: string, novoStatus: StatusEfetivo) {
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa) return;
    const statusAtual = statusEfetivo(tarefa);
    if (statusAtual === novoStatus) return;
    if (novoStatus === "Atrasada") return;

    const statusAnterior = tarefa.status;
    const dataConclusaoAnterior = tarefa.data_conclusao;

    const novaDataConclusao =
      novoStatus === "Concluída"
        ? new Date().toISOString().slice(0, 10)
        : null;

    setTarefas((prev) =>
      prev.map((t) =>
        t.id === tarefaId
          ? { ...t, status: novoStatus, data_conclusao: novaDataConclusao }
          : t
      )
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("tarefas")
      .update({
        status: novoStatus,
        data_conclusao: novaDataConclusao,
      })
      .eq("id", tarefaId);

    if (error) {
      setTarefas((prev) =>
        prev.map((t) =>
          t.id === tarefaId
            ? { ...t, status: statusAnterior, data_conclusao: dataConclusaoAnterior }
            : t
        )
      );
      alert("Erro ao mover tarefa: " + error.message);
      return;
    }

    if (undoInfo) clearTimeout(undoInfo.timeoutId);
    const timeoutId = setTimeout(() => setUndoInfo(null), 5000);
    setUndoInfo({
      tipo: "status",
      id: tarefaId,
      statusAnterior,
      dataConclusaoAnterior,
      timeoutId,
    });
  }

  // ---------------------------------------------------------------------------
  // Mover por etapa
  // ---------------------------------------------------------------------------
  async function moverPorEtapa(tarefaId: string, novaEtapa: string) {
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa) return;
    if (tarefa.fase === novaEtapa) return;

    const etapaAnterior = tarefa.fase;

    setTarefas((prev) =>
      prev.map((t) =>
        t.id === tarefaId ? { ...t, fase: novaEtapa } : t
      )
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("tarefas")
      .update({ fase: novaEtapa })
      .eq("id", tarefaId);

    if (error) {
      setTarefas((prev) =>
        prev.map((t) =>
          t.id === tarefaId ? { ...t, fase: etapaAnterior } : t
        )
      );
      alert("Erro ao mover tarefa: " + error.message);
      return;
    }

    if (undoInfo) clearTimeout(undoInfo.timeoutId);
    const timeoutId = setTimeout(() => setUndoInfo(null), 5000);
    setUndoInfo({
      tipo: "etapa",
      id: tarefaId,
      etapaAnterior,
      timeoutId,
    });
  }

  // ---------------------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------------------
  async function desfazer() {
    if (!undoInfo) return;
    clearTimeout(undoInfo.timeoutId);

    const supabase = createClient();

    if (undoInfo.tipo === "status") {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: undoInfo.statusAnterior,
          data_conclusao: undoInfo.dataConclusaoAnterior,
        })
        .eq("id", undoInfo.id);

      if (error) {
        alert("Erro ao desfazer: " + error.message);
        return;
      }

      setTarefas((prev) =>
        prev.map((t) =>
          t.id === undoInfo.id
            ? {
                ...t,
                status: undoInfo.statusAnterior,
                data_conclusao: undoInfo.dataConclusaoAnterior,
              }
            : t
        )
      );
    } else {
      const { error } = await supabase
        .from("tarefas")
        .update({ fase: undoInfo.etapaAnterior })
        .eq("id", undoInfo.id);

      if (error) {
        alert("Erro ao desfazer: " + error.message);
        return;
      }

      setTarefas((prev) =>
        prev.map((t) =>
          t.id === undoInfo.id ? { ...t, fase: undoInfo.etapaAnterior } : t
        )
      );
    }

    setUndoInfo(null);
  }

  function alternarExpandir(colId: string) {
    setColunasExpandidas((prev) => {
      const novo = new Set(prev);
      if (novo.has(colId)) novo.delete(colId);
      else novo.add(colId);
      return novo;
    });
  }

  // ---------------------------------------------------------------------------
  // Drag
  // ---------------------------------------------------------------------------
  function handleDragStart(e: React.DragEvent, tarefaId: string) {
    if (!podeEdit) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tarefaId);
    setDraggingId(tarefaId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColuna(null);
  }

  function handleDragOver(e: React.DragEvent, colId: string, desabilitada: boolean) {
    if (!podeEdit || desabilitada) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColuna(colId);
  }

  function handleDragLeave() {
    setDragOverColuna(null);
  }

  function handleDrop(e: React.DragEvent, colId: string, desabilitada: boolean) {
    e.preventDefault();
    if (desabilitada) return;
    const tarefaId = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setDragOverColuna(null);
    if (!tarefaId) return;

    if (modo === "status") {
      moverPorStatus(tarefaId, colId as StatusEfetivo);
    } else {
      moverPorEtapa(tarefaId, colId);
    }
  }

  const ehStatus = modo === "status";

  return (
    <>
      <div className="bg-white border border-[#e5e5ea] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3 px-1 flex-wrap">
          <span className="text-[10px] tracking-[0.12em] uppercase text-[#8e8e9a] font-mono">
            02
          </span>
          <h2
            className="text-xl font-medium text-[#18182a] tracking-tight"
            style={{ fontFamily: "var(--font-bricolage), serif" }}
          >
            Quadro de tarefas
          </h2>

          <div className="flex items-center border border-[#d4d4da] rounded-md overflow-hidden text-[11px]">
            <button
              onClick={() => setModo("status")}
              className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors ${
                ehStatus
                  ? "bg-[#0c0059] text-white"
                  : "bg-white text-[#4a4a5a] hover:bg-[#ffffff]"
              }`}
              title="Agrupar por status"
            >
              <LayoutList className="w-3 h-3" />
              Por status
            </button>
            <button
              onClick={() => setModo("etapa")}
              className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors ${
                !ehStatus
                  ? "bg-[#0c0059] text-white"
                  : "bg-white text-[#4a4a5a] hover:bg-[#ffffff]"
              }`}
              title="Agrupar por etapa"
            >
              <Layers className="w-3 h-3" />
              Por etapa
            </button>
          </div>

          <span className="text-[10px] text-[#8e8e9a] font-mono ml-auto">
            {podeEdit
              ? `arraste cards para mover · clique para detalhes`
              : "somente leitura"}
          </span>
          {podeEdit && (
            <button
              onClick={() => setNovaAberta(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#0c0059] hover:bg-[#18182a] text-white rounded-md transition-colors shrink-0"
              title="Adicionar nova tarefa"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova tarefa
            </button>
          )}
        </div>

        {colunas.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#8e8e9a]">
            Nenhuma etapa ainda. Crie uma tarefa para começar.
          </div>
        ) : ehStatus ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {colunas.map((c) => renderColuna(c))}
          </div>
        ) : (
          <>
            {/* Barra de scroll superior sincronizada */}
            <div
              ref={trilhoSuperiorRef}
              onScroll={handleScrollSuperior}
              className="overflow-x-auto overflow-y-hidden mb-2"
              style={{ height: 14 }}
            >
              {/* Trilho invisível com largura igual ao conteúdo abaixo */}
              <div style={{ width: larguraConteudo, height: 1 }} />
            </div>

            {/* Conteúdo real do kanban (também rola, sincronizado com a barra acima) */}
            <div
              ref={conteudoRef}
              onScroll={handleScrollConteudo}
              className="overflow-x-auto pb-1"
            >
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${colunas.length}, minmax(220px, 1fr))`,
                }}
              >
                {colunas.map((c) => renderColuna(c))}
              </div>
            </div>
          </>
        )}
      </div>

      {undoInfo && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#18182a] text-white rounded-lg shadow-xl px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm">Tarefa movida.</span>
          <button
            onClick={desfazer}
            className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Desfazer
          </button>
          <button
            onClick={() => {
              if (undoInfo) clearTimeout(undoInfo.timeoutId);
              setUndoInfo(null);
            }}
            className="text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {novaAberta && (
        <NewTaskModal
          projetoId={projetoId}
          fasesExistentes={etapasExistentes}
          membros={membros}
          onClose={() => setNovaAberta(false)}
          onCreated={() => {
            setNovaAberta(false);
          }}
        />
      )}
    </>
  );

  function renderColuna(c: Coluna) {
    const items = grupos.get(c.id) ?? [];
    const expandida = colunasExpandidas.has(c.id);
    const visiveis = expandida ? items : items.slice(0, ITEMS_POR_COLUNA);
    const isDragOver = dragOverColuna === c.id;
    const desabilitado = c.desabilitada;

    const cores = ehStatus
      ? STATUS_COLORS[c.id as StatusEfetivo]
      : CORES_ETAPA;

    return (
      <div
        key={c.id}
        onDragOver={(e) => handleDragOver(e, c.id, desabilitado)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, c.id, desabilitado)}
        className={`rounded-lg p-2.5 min-h-[200px] transition-all ${
          isDragOver
            ? ehStatus
              ? "bg-[#e6eef7] ring-2 ring-[#2e75b6]"
              : "bg-[#e5e5ea] ring-2 ring-[#8e8e9a]"
            : "bg-[#ffffff]"
        } ${desabilitado && draggingId ? "opacity-50" : ""}`}
      >
        <div
          className="flex items-center justify-between pb-2 mb-2 border-b border-dashed gap-2"
          style={{ borderColor: cores.bar, color: cores.fg }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {c.badge && (
              <span
                className="text-[9px] font-mono shrink-0 px-1 rounded"
                style={{ background: cores.bar, color: "white" }}
              >
                {c.badge}
              </span>
            )}
            <span
              className="text-[11px] font-semibold uppercase tracking-wide truncate"
              title={c.label}
            >
              {c.label}
            </span>
          </div>
          <span
            className="text-[10px] text-white font-mono font-medium rounded-full px-1.5 min-w-[18px] text-center shrink-0"
            style={{ background: cores.bar }}
          >
            {items.length}
          </span>
        </div>

        <div className="space-y-1.5">
          {visiveis.map((t) => (
            <CardTarefa
              key={t.id}
              tarefa={t}
              isDragging={draggingId === t.id}
              podeEdit={podeEdit}
              membros={membros}
              onDragStart={(e) => handleDragStart(e, t.id)}
              onDragEnd={handleDragEnd}
              onClick={() => onTaskClick(t)}
            />
          ))}
        </div>

        {items.length > ITEMS_POR_COLUNA && (
          <button
            onClick={() => alternarExpandir(c.id)}
            className="w-full text-[11px] mt-2 py-1.5 text-[#4a4a5a] hover:bg-white rounded-md transition-colors font-medium"
          >
            {expandida
              ? "Mostrar menos"
              : `Mostrar mais (${items.length - ITEMS_POR_COLUNA})`}
          </button>
        )}
      </div>
    );
  }
}

function CardTarefa({
  tarefa,
  isDragging,
  podeEdit,
  membros,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  tarefa: Tarefa;
  isDragging: boolean;
  podeEdit: boolean;
  membros: MembroAtribuicao[];
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const statusEf = statusEfetivo(tarefa);
  const cores = STATUS_COLORS[statusEf];
  const corPrio = PRIORIDADE_COLORS[tarefa.prioridade];
  const { num } = parseFase(tarefa.fase);
  const respLabel = exibirResponsavel(tarefa.responsavel, membros);

  return (
    <div
      draggable={podeEdit}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        bg-white border border-[#e5e5ea] rounded-md px-2.5 py-2 shadow-sm
        hover:-translate-y-px hover:shadow transition-all
        ${podeEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
        ${isDragging ? "opacity-40 scale-95 rotate-1" : ""}
      `}
      style={{ borderLeft: `3px solid ${cores.bar}` }}
    >
      <div className="flex items-center justify-between gap-2 text-[9px] text-[#8e8e9a] font-mono">
        <span>
          {tarefa.codigo} · {num}
        </span>
      </div>
      <div className="text-[12px] font-medium text-[#18182a] mt-1 leading-snug">
        {tarefa.titulo}
      </div>
      <div className="text-[10px] text-[#8e8e9a] mt-1 truncate" title={respLabel}>
        {respLabel}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#8e8e9a]">
        <span>{fmtData(tarefa.prazo)}</span>
        <span
          className="font-mono text-[9px] uppercase font-medium px-1.5 py-0.5 rounded"
          style={{ background: corPrio.bg, color: corPrio.fg }}
        >
          {tarefa.prioridade}
        </span>
      </div>
    </div>
  );
}