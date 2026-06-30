"use server";

import { createClient } from "@/lib/supabase/server";

export type ResultadoUpload = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
  storagePath?: string;
  url?: string;
};

// Upload feito no SERVIDOR: o cliente server (createClient com cookies) carrega
// a sessão do usuário, então auth.uid() existe e o RLS do Storage
// (is_playbook_editor()) é satisfeito. O cliente do navegador não leva a sessão
// para o Storage de forma confiavel (cookies httpOnly), por isso subimos aqui.
export async function subirArquivo(formData: FormData): Promise<ResultadoUpload> {
  const file = formData.get("file");
  const bucket = formData.get("bucket");
  const path = formData.get("path");
  if (!(file instanceof File) || typeof bucket !== "string" || typeof path !== "string") {
    return { status: "erro", mensagem: "Dados de upload incompletos." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (error) return { status: "erro", mensagem: error.message };
  return { status: "ok", storagePath: path };
}

export async function removerArquivo(
  bucket: string,
  path: string
): Promise<ResultadoUpload> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { status: "erro", mensagem: error.message };
  return { status: "ok" };
}

// URL assinada para buckets privados (ex.: planilhas de leads). Gera no servidor
// pois exige sessao; o bucket publico usa URL publica direta (sem auth).
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
