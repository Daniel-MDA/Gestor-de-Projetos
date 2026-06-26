"use client";

import { useMemo, useState } from "react";
import type { Dados, Aba } from "./tipos";
import { ABAS } from "./tipos";
import LogisticaTab from "./LogisticaTab";
import ChecklistTab from "./ChecklistTab";
import LeadsTab from "./LeadsTab";
import PortalTab from "./PortalTab";
import styles from "./checklist.module.css";

export default function ChecklistSection({
  dados,
  estaLogado,
  podeEditar,
}: {
  dados: Dados;
  estaLogado: boolean;
  podeEditar: boolean;
}) {
  const eventos = useMemo(
    () => [...dados.eventos].sort((a, b) => a.ordem - b.ordem),
    [dados.eventos]
  );

  const [feiraSelecionada, setFeiraSelecionada] = useState<string>(
    eventos[0]?.id ?? ""
  );
  const [abaAtiva, setAbaAtiva] = useState<Aba>("logistica");
  const [erro, setErro] = useState<string | null>(null);

  // Total de itens da árvore (igual para todas as feiras).
  const totalItens = useMemo(
    () => dados.categorias.reduce((s, c) => s + c.itens.length, 0),
    [dados.categorias]
  );

  // Itens marcados de uma feira (para a barra de progresso das pills).
  function marcadosDe(eventoId: string): number {
    const m = dados.marcacoes[eventoId];
    if (!m) return 0;
    let n = 0;
    for (const cat of dados.categorias) {
      for (const it of cat.itens) {
        if (m[it.id]?.marcado) n++;
      }
    }
    return n;
  }

  const eventoAtual = eventos.find((e) => e.id === feiraSelecionada);
  const marcacoesFeira = dados.marcacoes[feiraSelecionada] ?? {};

  if (eventos.length === 0) {
    return (
      <section className="section" id="checklist">
        <div className="pb-container">
          <div className="section-head">
            <div className="section-num">[03] PÁGINA DA FEIRA</div>
            <h2 className="section-title">
              Cada feira, sua página. <em>Checklist e logística.</em>
            </h2>
          </div>
          <div className={styles.emptyState}>
            <strong>Nenhuma feira cadastrada</strong>
            As páginas das feiras aparecerão aqui assim que os eventos forem
            cadastrados.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section" id="checklist">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">[03] PÁGINA DA FEIRA</div>
          <h2 className="section-title">
            Cada feira, sua página. <em>Checklist e logística.</em>
          </h2>
        </div>
        <p className="section-intro">
          Escolha a feira abaixo para abrir a página dela. Cada feira tem suas
          abas: <strong>Logística &amp; Stand</strong>,{" "}
          <strong>Checklist</strong> (o que levar, item por item),{" "}
          <strong>Captação de Leads</strong> e{" "}
          <strong>Portal do Expositor</strong>. Tudo é salvo separadamente por
          feira.
        </p>

        {erro ? <p className={`section-intro ${styles.erro}`}>{erro}</p> : null}

        {/* Seletor de feira (pills) */}
        <div className={styles.evSelector}>
          {eventos.map((ev, i) => {
            const m = marcadosDe(ev.id);
            const pct = totalItens > 0 ? (m / totalItens) * 100 : 0;
            const ativa = ev.id === feiraSelecionada;
            return (
              <button
                key={ev.id}
                type="button"
                className={`${styles.evPill} ${ativa ? styles.active : ""}`}
                onClick={() => setFeiraSelecionada(ev.id)}
              >
                <div className={styles.evPillNum}>
                  [{String(i + 1).padStart(2, "0")}]{" "}
                  {ev.status === "CONCLUÍDO" ? "✓" : ""}
                </div>
                <div className={styles.evPillNome}>{ev.nome}</div>
                <div className={styles.evPillData}>{ev.data}</div>
                <div className={styles.evPillProg}>
                  <span>Itens marcados</span>
                  <strong>
                    {m}/{totalItens}
                  </strong>
                </div>
                <div className={styles.evPillBar}>
                  <div
                    className={styles.evPillBarFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Header da feira selecionada */}
        <div className={styles.checklistHead}>
          <div>
            <h3>{eventoAtual?.nome ?? "—"}</h3>
            <div className={styles.meta}>
              {[eventoAtual?.local, eventoAtual?.data].filter(Boolean).join(" · ") ||
                "—"}
            </div>
          </div>
          <div className={styles.stats}>
            <div>
              <div className={styles.statNum}>
                {marcadosDe(feiraSelecionada)}
                <span className={styles.div}>/{totalItens}</span>
              </div>
              <div className={styles.meta}>Itens marcados</div>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className={styles.pageTabs}>
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              type="button"
              className={`${styles.pageTab} ${abaAtiva === aba.id ? styles.active : ""}`}
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba ativa */}
        {abaAtiva === "logistica" ? (
          <LogisticaTab
            eventoId={feiraSelecionada}
            logistica={dados.logistica[feiraSelecionada]}
            podeEditar={podeEditar}
            onErro={setErro}
          />
        ) : null}

        {abaAtiva === "checklist" ? (
          <ChecklistTab
            eventoId={feiraSelecionada}
            setores={dados.setores}
            categorias={dados.categorias}
            marcacoes={marcacoesFeira}
            podeEditar={podeEditar}
            onErro={setErro}
          />
        ) : null}

        {abaAtiva === "leads" ? (
          <LeadsTab
            eventoId={feiraSelecionada}
            leads={dados.leads[feiraSelecionada]}
            estaLogado={estaLogado}
            podeEditar={podeEditar}
            onErro={setErro}
          />
        ) : null}

        {abaAtiva === "portal" ? (
          <PortalTab
            eventoId={feiraSelecionada}
            portal={dados.portais[feiraSelecionada]}
            estaLogado={estaLogado}
            podeEditar={podeEditar}
            onErro={setErro}
          />
        ) : null}
      </div>
    </section>
  );
}
