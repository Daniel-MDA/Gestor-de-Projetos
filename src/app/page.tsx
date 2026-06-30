import Link from "next/link";
import { ListChecks, BookOpen, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Tecnofink",
  description: "Gestor de Tarefas e Playbook 2026 da Tecnofink",
};

const ferramentas = [
  {
    href: "/tarefas",
    Icon: ListChecks,
    titulo: "Gestor de Tarefas",
    descricao: "Projetos, kanban e cronograma da equipe.",
  },
  {
    href: "/playbook",
    Icon: BookOpen,
    titulo: "Playbook 2026",
    descricao: "Eventos, feiras, checklists e logística de marketing.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen tf-grid-bg flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <header className="text-center mb-12">
          <div className="text-[11px] tracking-[0.25em] uppercase text-[#8e8e9a] font-mono mb-3">
            Tecnofink
          </div>
          <h1
            className="text-3xl sm:text-4xl text-[#18182a]"
            style={{ fontFamily: "var(--font-bricolage), serif" }}
          >
            Selecione uma ferramenta
          </h1>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {ferramentas.map(({ href, Icon, titulo, descricao }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white border border-[#e5e5ea] rounded-2xl p-7 flex flex-col gap-4 hover:border-[#0c0059] hover:shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-[#f1f2f7] flex items-center justify-center text-[#0c0059] group-hover:bg-[#0c0059] group-hover:text-white transition-colors">
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2
                  className="text-lg text-[#18182a] mb-1"
                  style={{ fontFamily: "var(--font-bricolage), serif" }}
                >
                  {titulo}
                </h2>
                <p className="text-sm text-[#8e8e9a] leading-relaxed">
                  {descricao}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-sm text-[#0c0059] font-medium">
                Acessar
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-12 text-center text-[11px] text-[#a8a59c] font-mono tracking-wider">
          Tecnofink
        </footer>
      </div>
    </main>
  );
}
