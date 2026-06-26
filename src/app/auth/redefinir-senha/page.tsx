"use client";
 
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Check } from "lucide-react";
 
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
 
  async function handleSubmit() {
    setErro(null);
 
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }
 
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
 
    if (error) {
      setErro("Não foi possível redefinir a senha: " + error.message);
      return;
    }
 
    setOk(true);
    setTimeout(() => {
      router.push("/tarefas");
    }, 2000);
  }
 
  return (
    <main className="min-h-screen bg-[#f8f6f1] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-[#e6e2d6] rounded-2xl p-8 shadow-sm">
        <p className="text-[10px] tracking-[0.12em] uppercase text-[#7c7a72] font-mono mb-2">
          Tecnofink · Sistema interno
        </p>
        <h1
          className="text-3xl font-medium text-[#1a1815] tracking-tight mb-1"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Redefinir <em className="italic text-[#1f4e79]">senha</em>
        </h1>
        <p className="text-sm text-[#7c7a72] mb-6">
          Escolha uma nova senha para sua conta.
        </p>
 
        {ok ? (
          <div className="flex items-center gap-3 bg-[#d9f0df] text-[#1f6f3e] rounded-lg px-4 py-3 text-sm">
            <Check className="w-5 h-5 shrink-0" />
            Senha redefinida com sucesso! Redirecionando…
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] tracking-[0.08em] uppercase text-[#7c7a72] font-mono mb-1.5">
                Nova senha
              </label>
              <div className="flex items-center gap-2 bg-[#fbfaf6] border border-[#e6e2d6] rounded-lg px-3 py-2.5 focus-within:border-[#1f4e79] transition-colors">
                <Lock className="w-4 h-4 text-[#7c7a72] shrink-0" />
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-transparent outline-none text-sm text-[#1a1815] w-full"
                  autoFocus
                />
              </div>
            </div>
 
            <div>
              <label className="block text-[10px] tracking-[0.08em] uppercase text-[#7c7a72] font-mono mb-1.5">
                Confirmar nova senha
              </label>
              <div className="flex items-center gap-2 bg-[#fbfaf6] border border-[#e6e2d6] rounded-lg px-3 py-2.5 focus-within:border-[#1f4e79] transition-colors">
                <Lock className="w-4 h-4 text-[#7c7a72] shrink-0" />
                <input
                  type="password"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  placeholder="Digite novamente"
                  className="bg-transparent outline-none text-sm text-[#1a1815] w-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                />
              </div>
            </div>
 
            {erro && (
              <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] rounded-lg px-3 py-2 text-sm">
                {erro}
              </div>
            )}
 
            <button
              onClick={handleSubmit}
              disabled={salvando}
              className="w-full bg-[#1a1815] hover:bg-[#1f4e79] disabled:opacity-50 text-white rounded-lg py-3 text-sm font-medium transition-colors"
            >
              {salvando ? "Salvando…" : "Redefinir senha"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
