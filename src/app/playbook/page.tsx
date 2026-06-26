import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Playbook 2026 — Tecnofink",
  description: "Playbook de eventos e marketing da Tecnofink",
};

// Placeholder temporário. Será substituído pelo playbook completo
// (8 seções, leitura pública em 3 níveis e edição por editores) nas próximas fases.
export default function PlaybookPage() {
  return (
    <main className="min-h-screen bg-[#f8f6f1] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="text-[11px] tracking-[0.25em] uppercase text-[#7c7a72] font-mono mb-3">
          Playbook 2026
        </div>
        <h1
          className="text-3xl text-[#1a1815] mb-3"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Em construção
        </h1>
        <p className="text-sm text-[#7c7a72] mb-8 leading-relaxed">
          O playbook de eventos e marketing está sendo preparado e estará
          disponível em breve.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#1f4e79] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
