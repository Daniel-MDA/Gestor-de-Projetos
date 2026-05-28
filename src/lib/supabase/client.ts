"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton para evitar criar múltiplas instâncias do cliente,
// que podem desincronizar a sessão entre componentes.
let cliente: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (cliente) return cliente;
  cliente = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cliente;
}
