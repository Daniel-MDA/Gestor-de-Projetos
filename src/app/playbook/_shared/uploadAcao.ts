"use server";

import { createClient } from "@/lib/supabase/server";

export type ResultadoUpload = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
  storagePath?: string;
  url?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function tokenDoUsuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { token: null as string | null };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { token: session?.access_token ?? null };
}

// Upload via REST com o Bearer token do usuário. NÃO usar o supabase-js storage
// client aqui: para buckets PÚBLICOS ele faz a requisição como anônimo, então o
// auth.uid() fica nulo e o RLS de escrita (is_playbook_editor()) bloqueia. O
// fetch autenticado funciona em buckets públicos e privados.
export async function subirArquivo(formData: FormData): Promise<ResultadoUpload> {
  const file = formData.get("file");
  const bucket = formData.get("bucket");
  const path = formData.get("path");
  if (!(file instanceof File) || typeof bucket !== "string" || typeof path !== "string") {
    return { status: "erro", mensagem: "Dados de upload incompletos." };
  }
  const { token } = await tokenDoUsuario();
  if (!token) return { status: "nao_autenticado" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: bytes,
    }
  );
  if (!res.ok) {
    let msg = `Falha no upload (${res.status}).`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {}
    return { status: "erro", mensagem: msg };
  }
  return { status: "ok", storagePath: path };
}

export async function removerArquivo(
  bucket: string,
  path: string
): Promise<ResultadoUpload> {
  const { token } = await tokenDoUsuario();
  if (!token) return { status: "nao_autenticado" };
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!res.ok) {
    let msg = `Falha ao remover (${res.status}).`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {}
    return { status: "erro", mensagem: msg };
  }
  return { status: "ok" };
}

// URL assinada para bucket privado (leads). Aqui o supabase-js funciona (não é
// bucket público), então mantemos o caminho simples.
export async function urlAssinada(
  bucket: string,
  path: string
): Promise<ResultadoUpload> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  if (error || !data) return { status: "erro", mensagem: "Falha ao gerar URL." };
  return { status: "ok", url: data.signedUrl };
}
