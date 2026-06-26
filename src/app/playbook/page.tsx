import { getPlaybookViewer, fetchEventos } from "@/lib/playbook";
import PlaybookNav from "./PlaybookNav";
import EventosSection from "./EventosSection";
import AssociacoesSection from "./associacoes/AssociacoesSection";
import { carregar as carregarAssociacoes } from "./associacoes/dados";
import ProspeccaoSection from "./prospeccao/ProspeccaoSection";
import { carregar as carregarProspeccao } from "./prospeccao/dados";
import BrindesSection from "./brindes/BrindesSection";
import { carregar as carregarBrindes } from "./brindes/dados";
import WorkshopsSection from "./workshops/WorkshopsSection";
import { carregar as carregarWorkshops } from "./workshops/dados";

// Server Component: leitura pública (anon lê via RLS). O viewer decide o que
// é editável. Renderiza sempre — não redireciona para login.
export default async function PlaybookPage() {
  const [
    { user, podeEditar },
    eventos,
    associacoes,
    prospeccao,
    brindes,
    workshops,
  ] = await Promise.all([
    getPlaybookViewer(),
    fetchEventos(),
    carregarAssociacoes(),
    carregarProspeccao(),
    carregarBrindes(),
    carregarWorkshops(),
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
        <AssociacoesSection dados={associacoes} podeEditar={podeEditar} />
        <ProspeccaoSection dados={prospeccao} podeEditar={podeEditar} />
        <BrindesSection dados={brindes} podeEditar={podeEditar} />
        <WorkshopsSection dados={workshops} podeEditar={podeEditar} />
      </main>
    </>
  );
}
