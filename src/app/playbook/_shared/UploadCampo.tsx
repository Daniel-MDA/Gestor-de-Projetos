"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { nomeSeguro } from "./storage";

export type ResultadoUpload = { status: string; mensagem?: string };

// Campo reutilizável de anexo: faz upload para o Storage (cliente autenticado),
// salva o caminho via Server Action, e abre via URL pública (bucket público)
// ou URL assinada (bucket privado). Editor pode enviar/remover; demais só veem.
export default function UploadCampo({
  bucket,
  pathPrefix,
  publico,
  podeEditar,
  accept,
  storagePath,
  nomeArquivo,
  onSalvar,
  onRemover,
}: {
  bucket: string;
  pathPrefix: string;
  publico: boolean;
  podeEditar: boolean;
  accept?: string;
  storagePath: string | null;
  nomeArquivo: string | null;
  onSalvar: (storagePath: string, nomeArquivo: string) => Promise<ResultadoUpload>;
  onRemover: () => Promise<ResultadoUpload>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function abrir() {
    if (!storagePath) return;
    if (publico) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      window.open(data.publicUrl, "_blank", "noopener");
      return;
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);
    if (error || !data) {
      setErro("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function enviar(file: File) {
    setErro(null);
    setBusy(true);
    const path = `${pathPrefix}/${Date.now()}_${nomeSeguro(file.name)}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });
    if (error) {
      setBusy(false);
      setErro("Falha no upload: " + error.message);
      return;
    }
    const r = await onSalvar(path, file.name);
    setBusy(false);
    if (r.status === "ok") startTransition(() => router.refresh());
    else setErro(r.mensagem ?? "Falha ao salvar o anexo.");
  }

  async function remover() {
    if (!storagePath) return;
    setErro(null);
    setBusy(true);
    await supabase.storage.from(bucket).remove([storagePath]);
    const r = await onRemover();
    setBusy(false);
    if (r.status === "ok") startTransition(() => router.refresh());
    else setErro(r.mensagem ?? "Falha ao remover o anexo.");
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {storagePath ? (
        <>
          <button type="button" className="pb-link-btn" onClick={abrir}>
            {nomeArquivo ?? "Abrir arquivo"} ↗
          </button>
          {podeEditar ? (
            <button
              type="button"
              className="pb-link-btn pb-link-danger"
              onClick={remover}
              disabled={busy}
            >
              remover
            </button>
          ) : null}
        </>
      ) : podeEditar ? (
        <label className="pb-upload-label">
          {busy ? "Enviando…" : "Enviar arquivo"}
          <input
            type="file"
            accept={accept}
            disabled={busy}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void enviar(f);
            }}
          />
        </label>
      ) : (
        <span style={{ color: "var(--ink-3)" }}>—</span>
      )}
      {erro ? (
        <span style={{ color: "var(--crit)", fontSize: "0.8rem" }}>{erro}</span>
      ) : null}
    </div>
  );
}
