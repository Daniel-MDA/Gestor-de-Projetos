"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { nomeSeguro } from "./storage";
import { subirArquivo, removerArquivo, urlAssinada } from "./uploadAcao";

export type ResultadoUpload = { status: string; mensagem?: string };

// Campo reutilizável de anexo. O upload/remoção/URL-assinada passam por Server
// Actions (cliente server autenticado via cookies) — o cliente do navegador não
// leva a sessão ao Storage de forma confiável. Leitura pública = URL direta.
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
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function urlPublica(path: string) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const enc = path.split("/").map(encodeURIComponent).join("/");
    return `${base}/storage/v1/object/public/${bucket}/${enc}`;
  }

  async function abrir() {
    if (!storagePath) return;
    if (publico) {
      window.open(urlPublica(storagePath), "_blank", "noopener");
      return;
    }
    const r = await urlAssinada(bucket, storagePath);
    if (r.status === "ok" && r.url) window.open(r.url, "_blank", "noopener");
    else setErro("Não foi possível abrir o arquivo.");
  }

  async function enviar(file: File) {
    setErro(null);
    setBusy(true);
    const path = `${pathPrefix}/${Date.now()}_${nomeSeguro(file.name)}`;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("bucket", bucket);
    fd.set("path", path);
    const up = await subirArquivo(fd);
    if (up.status !== "ok" || !up.storagePath) {
      setBusy(false);
      setErro(
        up.status === "nao_autenticado"
          ? "Sua sessão expirou. Entre novamente."
          : up.mensagem ?? "Falha no upload."
      );
      return;
    }
    const r = await onSalvar(up.storagePath, file.name);
    setBusy(false);
    if (r.status === "ok") startTransition(() => router.refresh());
    else setErro(r.mensagem ?? "Falha ao salvar o anexo.");
  }

  async function remover() {
    if (!storagePath) return;
    setErro(null);
    setBusy(true);
    await removerArquivo(bucket, storagePath);
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
