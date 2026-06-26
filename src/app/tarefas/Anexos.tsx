/* Anexos.tsx
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Anexo,
  BUCKET_ANEXOS,
  MAX_TAMANHO_BYTES,
  fmtTamanho,
  construirStoragePath,
  iconeArquivo,
} from "@/lib/anexos";
import { PapelProjeto, ehAdmin } from "@/lib/permissoes";
import { tempoRelativo } from "@/lib/comentarios";
import { Upload, Download, Trash2, Loader2, X } from "lucide-react";

type Props = {
  tarefaId: string;
  projetoId: string;
  papel: PapelProjeto | null;
  podeEditar: boolean;
  usuarioAtualId: string;
  onCountChange?: (count: number) => void;
};

export default function Anexos({
  tarefaId,
  projetoId,
  papel,
  podeEditar,
  usuarioAtualId,
  onCountChange,
}: Props) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ehAdminProjeto = ehAdmin(papel);

  // Atualiza contador no pai. Em useEffect pra evitar setState durante render.
  useEffect(() => {
    onCountChange?.(anexos.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anexos.length]);

  // Carrega anexos iniciais
  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("anexos")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("enviado_em", { ascending: false });

      if (error) {
        setErro("Erro ao carregar anexos: " + error.message);
      } else {
        setAnexos(data ?? []);
      }
      setCarregando(false);
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaId]);

  async function uploadArquivos(arquivos: FileList | File[]) {
    setErro(null);
    setEnviando(true);

    const lista = Array.from(arquivos);

    for (let i = 0; i < lista.length; i++) {
      const arquivo = lista[i];
      setProgresso(`Enviando ${i + 1}/${lista.length}: ${arquivo.name}`);

      if (arquivo.size > MAX_TAMANHO_BYTES) {
        setErro(
          `"${arquivo.name}" excede o limite de ${fmtTamanho(MAX_TAMANHO_BYTES)}.`
        );
        continue;
      }

      const supabase = createClient();
      const path = construirStoragePath(projetoId, tarefaId, arquivo.name);

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .upload(path, arquivo, {
          contentType: arquivo.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadErr) {
        setErro(`Erro ao enviar "${arquivo.name}": ${uploadErr.message}`);
        continue;
      }

      const { data: novoAnexo, error: insertErr } = await supabase
        .from("anexos")
        .insert({
          tarefa_id: tarefaId,
          nome_arquivo: arquivo.name,
          storage_path: path,
          tamanho_bytes: arquivo.size,
          tipo_mime: arquivo.type || null,
          enviado_por: usuarioAtualId,
        })
        .select()
        .single();

      if (insertErr) {
        await supabase.storage.from(BUCKET_ANEXOS).remove([path]);
        setErro(`Erro ao registrar "${arquivo.name}": ${insertErr.message}`);
        continue;
      }

      if (novoAnexo) {
        setAnexos((prev) => [novoAnexo as Anexo, ...prev]);
      }
    }

    setEnviando(false);
    setProgresso(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function baixarAnexo(anexo: Anexo) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_ANEXOS)
      .createSignedUrl(anexo.storage_path, 60);

    if (error || !data) {
      setErro("Erro ao gerar link: " + (error?.message ?? "desconhecido"));
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function excluir(anexo: Anexo) {
    if (!confirm(`Excluir "${anexo.nome_arquivo}"?`)) return;
    const supabase = createClient();

    const { error: storageErr } = await supabase.storage
      .from(BUCKET_ANEXOS)
      .remove([anexo.storage_path]);

    if (storageErr) {
      setErro("Erro ao remover arquivo: " + storageErr.message);
      return;
    }

    const { error: dbErr } = await supabase
      .from("anexos")
      .delete()
      .eq("id", anexo.id);

    if (dbErr) {
      setErro("Erro ao remover registro: " + dbErr.message);
      return;
    }

    setAnexos((prev) => prev.filter((a) => a.id !== anexo.id));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!podeEditar) return;
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!podeEditar) return;
    if (e.dataTransfer.files.length > 0) {
      uploadArquivos(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-3">
      {podeEditar && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
            ${
              dragOver
                ? "border-[#1f4e79] bg-[#e6eef7]"
                : "border-[#d0ccbf] bg-[#fbfaf6] hover:border-[#7c7a72]"
            }
            ${enviando ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && uploadArquivos(e.target.files)}
            className="hidden"
            disabled={enviando}
          />
          {enviando ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[#4b4942]">
              <Loader2 className="w-4 h-4 animate-spin" />
              {progresso ?? "Enviando…"}
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-[#7c7a72] mx-auto mb-1.5" />
              <div className="text-sm text-[#4b4942]">
                Clique ou arraste arquivos aqui
              </div>
              <div className="text-[10px] text-[#7c7a72] mt-1 font-mono">
                até {fmtTamanho(MAX_TAMANHO_BYTES)} por arquivo
              </div>
            </>
          )}
        </div>
      )}

      {erro && (
        <div className="flex items-start justify-between gap-2 bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-3 py-2 rounded-lg">
          <span>{erro}</span>
          <button onClick={() => setErro(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center py-6 text-sm text-[#7c7a72]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Carregando anexos…
        </div>
      ) : anexos.length === 0 ? (
        <div className="text-center py-6 text-sm text-[#7c7a72]">
          Nenhum anexo nesta tarefa.
        </div>
      ) : (
        <div className="space-y-1.5">
          {anexos.map((a) => {
            const podeExcluirAnexo = a.enviado_por === usuarioAtualId || ehAdminProjeto;
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 p-2.5 bg-[#fbfaf6] border border-[#e6e2d6] rounded-lg hover:bg-white transition-colors"
              >
                <span className="text-xl shrink-0">{iconeArquivo(a.tipo_mime)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#1a1815] font-medium truncate">
                    {a.nome_arquivo}
                  </div>
                  <div className="text-[10px] text-[#7c7a72] font-mono mt-0.5">
                    {fmtTamanho(a.tamanho_bytes)} · {tempoRelativo(a.enviado_em)}
                  </div>
                </div>
                <button
                  onClick={() => baixarAnexo(a)}
                  className="p-1.5 text-[#4b4942] hover:bg-[#e6eef7] hover:text-[#1f4e79] rounded transition-colors"
                  title="Baixar"
                >
                  <Download className="w-4 h-4" />
                </button>
                {podeExcluirAnexo && podeEditar && (
                  <button
                    onClick={() => excluir(a)}
                    className="p-1.5 text-[#7c7a72] hover:bg-[#fcdcd6] hover:text-[#8c2c1b] rounded transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
