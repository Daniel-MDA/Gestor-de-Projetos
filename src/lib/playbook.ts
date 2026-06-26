import { createClient } from "@/lib/supabase/server";

export type StatusEvento = "NÃO INICIADO" | "EM ANDAMENTO" | "CONCLUÍDO";
export type TipoEvento = "nacional" | "internacional";

export type Evento = {
  id: string;
  slug: string | null;
  nome: string;
  local: string | null;
  data: string;
  tipo: TipoEvento;
  status: StatusEvento;
  obs: string | null;
  is_custom: boolean;
  ordem: number;
};

// Quem está vendo o playbook: logado? editor? Usado para liberar a edição.
// A leitura do conteúdo é pública (RLS permite anon); a função is_playbook_editor()
// é SECURITY DEFINER e só retorna true para usuários na tabela playbook_editores.
export async function getPlaybookViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let podeEditar = false;
  if (user) {
    const { data, error } = await supabase.rpc("is_playbook_editor");
    if (!error) podeEditar = data === true;
  }
  return { user, podeEditar };
}

export async function fetchEventos(): Promise<Evento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbook_eventos")
    .select("id, slug, nome, local, data, tipo, status, obs, is_custom, ordem")
    .order("ordem", { ascending: true });
  if (error) throw new Error("Falha ao carregar eventos: " + error.message);
  return (data ?? []) as Evento[];
}
