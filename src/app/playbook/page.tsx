import { getPlaybookViewer, fetchEventos } from "@/lib/playbook";
import PlaybookNav from "./PlaybookNav";
import EventosSection from "./EventosSection";

// Server Component: leitura pública (anon lê via RLS). O viewer decide o que
// é editável. Renderiza sempre — não redireciona para login.
export default async function PlaybookPage() {
  const [{ user, podeEditar }, eventos] = await Promise.all([
    getPlaybookViewer(),
    fetchEventos(),
  ]);

  return (
    <>
      <PlaybookNav estaLogado={!!user} podeEditar={podeEditar} />
      <main>
        <section className="hero">
          <div className="pb-container">
            <div className="hero-tag">Tecnofink · Marketing</div>
            <h1>
              Playbook <em>2026</em>
            </h1>
            <p className="hero-sub">
              Programação de eventos, catálogos, checklists de feira e logística
              — o guia de marketing da Tecnofink, sempre atualizado.
            </p>
          </div>
        </section>

        <EventosSection eventos={eventos} podeEditar={podeEditar} />
      </main>
    </>
  );
}
