import { getPlaybookViewer, fetchEventos } from "@/lib/playbook";
import PlaybookNav from "./PlaybookNav";
import EventosSection from "./EventosSection";
import CatalogosSection from "./catalogos/CatalogosSection";
import { carregar as carregarCatalogos } from "./catalogos/dados";
import ChecklistSection from "./checklist/ChecklistSection";
import { carregar as carregarChecklist } from "./checklist/dados";
import AssociacoesSection from "./associacoes/AssociacoesSection";
import { carregar as carregarAssociacoes } from "./associacoes/dados";
import ProspeccaoSection from "./prospeccao/ProspeccaoSection";
import { carregar as carregarProspeccao } from "./prospeccao/dados";
import BrindesSection from "./brindes/BrindesSection";
import { carregar as carregarBrindes } from "./brindes/dados";
import StandsSection from "./stands2027/StandsSection";
import { carregar as carregarStands } from "./stands2027/dados";
import WorkshopsSection from "./workshops/WorkshopsSection";
import { carregar as carregarWorkshops } from "./workshops/dados";

// Server Component: leitura pública (anon lê via RLS). O viewer decide o que
// é editável. Renderiza sempre — não redireciona para login.
export default async function PlaybookPage() {
  const [
    { user, podeEditar },
    eventos,
    catalogos,
    checklist,
    associacoes,
    prospeccao,
    brindes,
    stands,
    workshops,
  ] = await Promise.all([
    getPlaybookViewer(),
    fetchEventos(),
    carregarCatalogos(),
    carregarChecklist(),
    carregarAssociacoes(),
    carregarProspeccao(),
    carregarBrindes(),
    carregarStands(),
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
        <CatalogosSection dados={catalogos} podeEditar={podeEditar} />
        <ChecklistSection
          dados={checklist}
          estaLogado={!!user}
          podeEditar={podeEditar}
        />
        <AssociacoesSection dados={associacoes} podeEditar={podeEditar} />
        <ProspeccaoSection dados={prospeccao} podeEditar={podeEditar} />
        <BrindesSection dados={brindes} podeEditar={podeEditar} />
        <StandsSection dados={stands} podeEditar={podeEditar} />
        <WorkshopsSection dados={workshops} podeEditar={podeEditar} />
      </main>
    </>
  );
}
