"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Botão de logout do playbook. Encerra a sessão e volta para a home (anônimo).
export default function SairButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function sair() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className="pb-sair" onClick={sair} disabled={loading}>
      {loading ? "Saindo…" : "Sair"}
    </button>
  );
}
