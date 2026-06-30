"use server";

import { createClient } from "@/lib/supabase/server";

export type ResultadoUpload = {
  status: "ok" | "nao_autenticado" | "nao_autorizado" | "erro";
  mensagem?: string;
  storagePath?: string;
  url?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Lê a service_role em RUNTIME (não no topo do módulo, que pode ser congelado
// no build antes da env var existir).
function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function semServiceKeyMsg() {
  const chaves = Object.keys(process.env)
    .filter((k) => /SUPA|SERVICE|ROLE/i.test(k))
    .join(", ");
  return `DEBUG SR ausente. url=${!!process.env.NEXT_PUBLIC_SUPABASE_URL} chaves=[${chaves}]`;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

// Verifica, usando a SESSÃO do usuário, se ele é editor do playbook. A RPC
// is_playbook_editor() funciona de forma confiável no server client (é o que
// alimenta o "MODO EDITOR"). Só depois disso usamos a service_role para o
// upload, que ignora o RLS do Storage (o supabase-js/token de sessão não
// funciona em bucket público — ver histórico).
async function exigirEditor(): Promise<ResultadoUpload | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };
  const { data, error } = await supabase.rpc("is_playbook_editor");
  if (error)
    return { status: "erro", mensagem: "Falha ao verificar permissão: " + error.message };
  if (data !== true)
    return { status: "nao_autorizado", mensagem: "Você não tem permissão de editor." };
  return null;
}

export async function subirArquivo(formData: FormData): Promise<ResultadoUpload> {
  const file = formData.get("file");
  const bucket = formData.get("bucket");
  const path = formData.get("path");
  if (!(file instanceof File) || typeof bucket !== "string" || typeof path !== "string") {
    return { status: "erro", mensagem: "Dados de upload incompletos." };
  }
  const barreira = await exigirEditor();
  if (barreira) return barreira;
  const SERVICE = serviceKey();
  if (!SERVICE) return { status: "erro", mensagem: semServiceKeyMsg() };

  const bytes = Buffer.from(await file.arrayBuffer());
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
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
  const barreira = await exigirEditor();
  if (barreira) return barreira;
  const SERVICE = serviceKey();
  if (!SERVICE) return { status: "erro", mensagem: semServiceKeyMsg() };
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
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

// URL assinada para bucket privado (leads). Exige apenas estar autenticado
// (leads são visíveis a qualquer logado). Assina via service_role.
export async function urlAssinada(
  bucket: string,
  path: string
): Promise<ResultadoUpload> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const SERVICE = serviceKey();
  if (!SERVICE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    if (error || !data) return { status: "erro", mensagem: "Falha ao gerar URL." };
    return { status: "ok", url: data.signedUrl };
  }
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    }
  );
  if (!res.ok) return { status: "erro", mensagem: "Falha ao gerar URL." };
  const j = await res.json();
  return { status: "ok", url: `${SUPABASE_URL}/storage/v1${j.signedURL}` };
}
