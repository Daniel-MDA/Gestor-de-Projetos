"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Evento, StatusEvento } from "@/lib/playbook";
import { ciclarStatusEvento } from "./acoes";

function classeStatus(s: StatusEvento) {
  if (s === "CONCLUÍDO") return "status-concluido";
  if (s === "EM ANDAMENTO") return "status-andamento";
  return "status-nao-iniciado";
}

export default function EventosSection({
  eventos,
  podeEditar,
}: {
  eventos: Evento[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const ordenados = [...eventos].sort((a, b) => a.ordem - b.ordem);
  const nacionais = ordenados.filter((e) => e.tipo === "nacional");
  const internacionais = ordenados.filter((e) => e.tipo === "internacional");

  // Numeração sequencial: nacionais primeiro, depois internacionais.
  const num = new Map<string, string>();
  [...nacionais, ...internacionais].forEach((e, i) =>
    num.set(e.id, String(i + 1).padStart(2, "0"))
  );

  function ciclar(ev: Evento) {
    setErro(null);
    setPendingId(ev.id);
    startTransition(async () => {
      const r = await ciclarStatusEvento(ev.id, ev.status);
      setPendingId(null);
      if (r.status === "ok") router.refresh();
      else if (r.status === "nao_autenticado")
        setErro("Sua sessão expirou. Entre novamente para editar.");
      else setErro(r.mensagem ?? "Não foi possível alterar o status.");
    });
  }

  function Card(ev: Evento) {
    const cls = `evento-status ${classeStatus(ev.status)}${podeEditar ? " editable" : ""}`;
    return (
      <article key={ev.id} className={`evento-card${ev.is_custom ? " custom" : ""}`}>
        <div className="evento-card-head">
          <span className="evento-num">[{num.get(ev.id)}]</span>
          {podeEditar ? (
            <button
              type="button"
              className={cls}
              disabled={pendingId === ev.id}
              onClick={() => ciclar(ev)}
              title="Clique para alterar o status"
            >
              {ev.status}
            </button>
          ) : (
            <span className={cls}>{ev.status}</span>
          )}
        </div>
        <h4>{ev.nome}</h4>
        {ev.local ? <p className="local">{ev.local}</p> : null}
        {ev.obs ? <p className="evento-obs">{ev.obs}</p> : null}
        <div className="evento-data">
          <span>{ev.data}</span>
        </div>
      </article>
    );
  }

  return (
    <section className="section" id="eventos">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">[01] EVENTOS</div>
          <h2 className="section-title">
            Programação 2026. <em>Nacionais e internacionais.</em>
          </h2>
        </div>
        <p className="section-intro">
          {podeEditar
            ? "Clique no selo de status de cada evento para avançá-lo (Não iniciado → Em andamento → Concluído)."
            : "Programação de eventos nacionais e internacionais da Tecnofink em 2026."}
        </p>
        {erro ? (
          <p className="section-intro" style={{ color: "var(--crit)" }}>
            {erro}
          </p>
        ) : null}

        <div className="eventos-grid">{nacionais.map(Card)}</div>
        {internacionais.length > 0 ? (
          <>
            <div className="intl-divider">
              <span>Eventos Internacionais</span>
            </div>
            <div className="eventos-grid">{internacionais.map(Card)}</div>
          </>
        ) : null}
      </div>
    </section>
  );
}
