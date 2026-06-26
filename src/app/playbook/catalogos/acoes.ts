"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { GrupoCatalogo } from "./tipos";

// Resultado padrão das ações (espelha o padrão {status} das RPCs do projeto).
export type ResultadoAcao = {
  status: "ok" | "nao_autenticado" | "erro";
  mensagem?: string;
};

// ── Catálogos (linhas das tabelas) ───────────────────────────────────────────

// Adiciona um novo catálogo. A ordem é o tamanho atual da lista. is_custom = true.
export async function adicionarCatalogo(
  nome: string,
  grupo: GrupoCatalogo,
  estoque: number,
  ordem: number
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const limpo = nome.trim();
  if (!limpo)
    return { status: "erro", mensagem: "Informe um nome para o catálogo." };

  const est = Number.isFinite(estoque) && estoque > 0 ? Math.trunc(estoque) : 0;

  const { error } = await supabase.from("playbook_catalogos").insert({
    nome: limpo,
    grupo,
    estoque: est,
    consumo_anual: 0,
    is_custom: true,
    ordem,
    atualizado_por: user.id,
  });

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Remove um catálogo (o cascade do banco apaga o consumo por evento).
export async function removerCatalogo(id: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const { error } = await supabase.from("playbook_catalogos").delete().eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// Edita o estoque atual de um catálogo (campo azul). Salva onBlur.
export async function editarEstoque(
  id: string,
  estoque: number
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const v = Number.isFinite(estoque) && estoque > 0 ? Math.trunc(estoque) : 0;

  const { error } = await supabase
    .from("playbook_catalogos")
    .update({ estoque: v, atualizado_por: user.id })
    .eq("id", id);

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}

// ── Consumo por evento (playbook_catalogo_consumo, PK composta) ──────────────

// Define a qtd consumida de um catálogo em um evento. Upsert pela PK composta.
// O consumo anual derivado (FBCC + futuro) é recalculado no cliente — NÃO persistido.
export async function editarConsumo(
  catalogoId: string,
  eventoCatalogoId: string,
  qtd: number
): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "nao_autenticado" };

  const v = Number.isFinite(qtd) && qtd > 0 ? Math.trunc(qtd) : 0;

  const { error } = await supabase.from("playbook_catalogo_consumo").upsert(
    {
      catalogo_id: catalogoId,
      evento_catalogo_id: eventoCatalogoId,
      qtd: v,
    },
    { onConflict: "catalogo_id,evento_catalogo_id" }
  );

  if (error) return { status: "erro", mensagem: error.message };
  revalidatePath("/playbook");
  return { status: "ok" };
}
