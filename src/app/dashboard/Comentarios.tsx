/* Comentarios.tsx
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Comentario,
  tempoRelativo,
  fmtDataHora,
  useComentariosRealtime,
} from "@/lib/comentarios";
import { PapelProjeto, ehAdmin } from "@/lib/permissoes";
import { Loader2, Send, Pencil, Trash2, Check, X } from "lucide-react";

type Props = {
  tarefaId: string;
  papel: PapelProjeto | null;
  podeEditar: boolean;
  usuarioAtualId: string;
  onCountChange?: (count: number) => void;
};

type AutorInfo = {
  email: string;
};

export default function Comentarios({
  tarefaId,
  papel,
  podeEditar,
  usuarioAtualId,
  onCountChange,
}: Props) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [autores, setAutores] = useState<Record<string, AutorInfo>>({});
  const [novoTexto, setNovoTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ehAdminProjeto = ehAdmin(papel);

  // Atualiza contador no pai sempre que a lista de comentários mudar.
  // Importante: chamamos onCountChange aqui (e NÃO dentro de setComentarios),
  // pois alterar estado do pai durante setter de filho causa erro do React.
  useEffect(() => {
    onCountChange?.(comentarios.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comentarios.length]);

  // Carrega comentários iniciais
  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("comentarios")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("criado_em", { ascending: true });

      if (error) {
        setErro("Erro ao carregar comentários: " + error.message);
      } else {
        setComentarios(data ?? []);
        await carregarAutores(data ?? []);
      }
      setCarregando(false);
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaId]);

  async function carregarAutores(lista: Comentario[]) {
    const ids = Array.from(new Set(lista.map((c) => c.autor_id)));
    if (ids.length === 0) return;
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const novosAutores: Record<string, AutorInfo> = {};
    for (const id of ids) {
      if (user && user.id === id) {
        novosAutores[id] = { email: user.email ?? "você" };
      } else {
        novosAutores[id] = { email: `Usuário (${id.slice(0, 8)})` };
      }
    }
    setAutores((prev) => ({ ...prev, ...novosAutores }));
  }

  // Realtime — sem chamar onCountChange aqui (vai pelo useEffect acima)
  useComentariosRealtime(tarefaId, {
    onInsert: (c) => {
      setComentarios((prev) => {
        if (prev.find((x) => x.id === c.id)) return prev;
        return [...prev, c].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
      });
      carregarAutores([c]);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    },
    onUpdate: (c) => {
      setComentarios((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    },
    onDelete: (id) => {
      setComentarios((prev) => prev.filter((x) => x.id !== id));
    },
  });

  async function enviarNovo() {
    const texto = novoTexto.trim();
    if (!texto) return;
    setEnviando(true);
    setErro(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("comentarios")
      .insert({
        tarefa_id: tarefaId,
        autor_id: usuarioAtualId,
        texto,
      })
      .select()
      .single();

    if (error) {
      setErro("Erro ao enviar: " + error.message);
    } else {
      // Atualiza estado localmente (não esperar o realtime — pode demorar 1-2s)
      if (data) {
        setComentarios((prev) => {
          if (prev.find((x) => x.id === data.id)) return prev;
          return [...prev, data as Comentario].sort((a, b) =>
            a.criado_em.localeCompare(b.criado_em)
          );
        });
      }
      setNovoTexto("");
    }
    setEnviando(false);
  }

  async function salvarEdicao(id: string) {
    const texto = textoEdicao.trim();
    if (!texto) {
      setEditandoId(null);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comentarios")
      .update({ texto, editado_em: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      setErro("Erro ao editar: " + error.message);
    } else {
      // Atualiza local imediatamente
      if (data) {
        setComentarios((prev) =>
          prev.map((x) => (x.id === id ? (data as Comentario) : x))
        );
      }
      setEditandoId(null);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este comentário?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("comentarios").delete().eq("id", id);

    if (error) {
      setErro("Erro ao excluir: " + error.message);
      return;
    }

    // Atualiza local imediatamente — não esperar realtime DELETE
    // (DELETE events do Supabase às vezes vêm sem ID se REPLICA IDENTITY não está como FULL)
    setComentarios((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
        {carregando ? (
          <div className="flex items-center justify-center py-6 text-sm text-[#7c7a72]">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Carregando comentários…
          </div>
        ) : comentarios.length === 0 ? (
          <div className="text-center py-6 text-sm text-[#7c7a72]">
            Nenhum comentário ainda. Seja o primeiro a comentar.
          </div>
        ) : (
          comentarios.map((c) => {
            const isAutor = c.autor_id === usuarioAtualId;
            const podeAlterar = isAutor;
            const podeExcluirComentario = isAutor || ehAdminProjeto;
            const editando = editandoId === c.id;
            const autor = autores[c.autor_id]?.email ?? "—";

            return (
              <div
                key={c.id}
                className="bg-[#fbfaf6] border border-[#e6e2d6] rounded-lg p-3"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-medium text-[#1a1815] truncate">
                      {autor}
                    </span>
                    <span
                      className="text-[10px] text-[#7c7a72] font-mono shrink-0"
                      title={fmtDataHora(c.criado_em)}
                    >
                      {tempoRelativo(c.criado_em)}
                      {c.editado_em && (
                        <span className="ml-1 italic">(editado)</span>
                      )}
                    </span>
                  </div>

                  {!editando && (podeAlterar || podeExcluirComentario) && (
                    <div className="flex items-center gap-1 shrink-0">
                      {podeAlterar && (
                        <button
                          onClick={() => {
                            setEditandoId(c.id);
                            setTextoEdicao(c.texto);
                          }}
                          className="p-1 text-[#7c7a72] hover:text-[#1a1815] hover:bg-white rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {podeExcluirComentario && (
                        <button
                          onClick={() => excluir(c.id)}
                          className="p-1 text-[#7c7a72] hover:text-[#8c2c1b] hover:bg-white rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editando ? (
                  <div>
                    <textarea
                      value={textoEdicao}
                      onChange={(e) => setTextoEdicao(e.target.value)}
                      rows={3}
                      className="w-full p-2 text-sm bg-white border border-[#d0ccbf] rounded outline-none focus:border-[#1f4e79] resize-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1 mt-1">
                      <button
                        onClick={() => setEditandoId(null)}
                        className="flex items-center gap-1 text-xs px-2 py-1 text-[#4b4942] hover:bg-white rounded transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Cancelar
                      </button>
                      <button
                        onClick={() => salvarEdicao(c.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-[#1f4e79] hover:bg-[#1a1815] text-white rounded transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <TextoComLinks texto={c.texto} />
                )}
              </div>
            );
          })
        )}
      </div>

      {erro && (
        <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-3 py-2 rounded-lg">
          {erro}
        </div>
      )}

      {podeEditar ? (
        <div className="border-t border-[#e6e2d6] pt-4">
          <div className="flex gap-2">
            <textarea
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  enviarNovo();
                }
              }}
              placeholder="Adicione um comentário... (Ctrl+Enter envia)"
              rows={2}
              className="flex-1 p-2.5 text-sm bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg outline-none focus:border-[#1f4e79] resize-none"
              disabled={enviando}
            />
            <button
              onClick={enviarNovo}
              disabled={enviando || !novoTexto.trim()}
              className="self-end flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1a1815] hover:bg-[#1f4e79] disabled:bg-[#7c7a72] disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#e6e2d6] pt-4 text-xs text-[#7c7a72] text-center">
          Você não tem permissão para comentar neste projeto.
        </div>
      )}
    </div>
  );
}

function TextoComLinks({ texto }: { texto: string }) {
  const regex = /(https?:\/\/[^\s]+)/g;
  const partes: React.ReactNode[] = [];
  let ultimo = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimo) {
      partes.push(<span key={`t-${i}`}>{texto.slice(ultimo, match.index)}</span>);
    }
    partes.push(
      <a
        key={`l-${i}`}
        href={match[1]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#1f4e79] hover:underline break-all"
      >
        {match[1]}
      </a>
    );
    ultimo = match.index + match[1].length;
    i++;
  }
  if (ultimo < texto.length) {
    partes.push(<span key={`t-end`}>{texto.slice(ultimo)}</span>);
  }

  return (
    <div className="text-sm text-[#1a1815] whitespace-pre-wrap break-words">
      {partes.length > 0 ? partes : texto}
    </div>
  );
}
