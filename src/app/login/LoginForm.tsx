"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, Loader2 } from "lucide-react";

export default function LoginForm() {
  // Estados do formulário
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepConnected, setKeepConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Traduz a mensagem mais comum
      if (signInError.message.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos.");
      } else if (signInError.message.includes("Email not confirmed")) {
        setError("E-mail ainda não confirmado.");
      } else {
        setError(signInError.message);
      }
      setLoading(false);
      return;
    }

    // Sucesso: redireciona pro dashboard
    router.push("/tarefas");
    router.refresh(); // força re-renderização com a nova sessão
  }

  return (
    <div className="bg-white border border-[#e6e2d6] rounded-2xl shadow-sm p-8">
      {/* Cabeçalho com identidade visual */}
      <div className="mb-7">
        <div className="text-[10px] tracking-[0.18em] uppercase text-[#7c7a72] mb-1 font-mono">
          Tecnofink · Sistema interno
        </div>
        <h1 className="text-3xl font-medium text-[#1a1815] tracking-tight">
          Acesso ao <em className="italic text-[#1f4e79]">sistema</em>
        </h1>
        <p className="text-sm text-[#7c7a72] mt-2">
          Entre com suas credenciais para continuar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo de e-mail */}
        <div>
          <label
            htmlFor="email"
            className="block text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] mb-1.5 font-mono"
          >
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c7a72]" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg text-sm text-[#1a1815] outline-none focus:border-[#1f4e79] transition-colors"
              placeholder="seu@email.com"
              disabled={loading}
            />
          </div>
        </div>

        {/* Campo de senha */}
        <div>
          <label
            htmlFor="password"
            className="block text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] mb-1.5 font-mono"
          >
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c7a72]" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-[#fbfaf6] border border-[#d0ccbf] rounded-lg text-sm text-[#1a1815] outline-none focus:border-[#1f4e79] transition-colors"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
        </div>

        {/* Checkbox de manter conectado */}
        <label className="flex items-center gap-2 text-sm text-[#4b4942] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={keepConnected}
            onChange={(e) => setKeepConnected(e.target.checked)}
            className="w-4 h-4 rounded border-[#d0ccbf] accent-[#1f4e79]"
            disabled={loading}
          />
          Manter-me conectado
        </label>

        {/* Mensagem de erro */}
        {error && (
          <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Botão de submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1a1815] hover:bg-[#1f4e79] disabled:bg-[#7c7a72] disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Entrando…
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      <p className="text-xs text-[#7c7a72] mt-6 text-center">
        Sistema de gestão de projetos · Tecnofink
      </p>
    </div>
  );
}