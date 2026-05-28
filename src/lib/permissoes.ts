import { createClient } from "@/lib/supabase/client";

export type PapelProjeto = "admin" | "editor" | "leitor";

/**
 * Busca o papel do usuário atual no projeto. Retorna null se não for membro.
 */
export async function obterPapelDoUsuario(
  projetoId: string
): Promise<PapelProjeto | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("membros_projeto")
    .select("papel")
    .eq("projeto_id", projetoId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  return (data?.papel as PapelProjeto) ?? null;
}

/**
 * Verifica se um papel permite edição (admin ou editor).
 */
export function podeEditar(papel: PapelProjeto | null): boolean {
  return papel === "admin" || papel === "editor";
}

/**
 * Verifica se um papel é admin.
 */
export function ehAdmin(papel: PapelProjeto | null): boolean {
  return papel === "admin";
}
