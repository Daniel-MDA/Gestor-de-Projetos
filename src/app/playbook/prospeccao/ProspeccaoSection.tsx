"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./prospeccao.module.css";
import {
  PARTICIPACAO_OPCOES,
  type Dados,
  type Participacao,
  type ProspEvento,
  type ProspSetor,
} from "./tipos";
import {
  adicionarSetor,
  editarSetor,
  removerSetor,
  adicionarEvento,
  editarEvento,
  removerEvento,
  type ResultadoAcao,
} from "./acoes";

export default function ProspeccaoSection({
  dados,
  podeEditar,
}: {
  dados: Dados;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // novo setor
  const [novoSetor, setNovoSetor] = useState("");
  // formularios de novo evento por setor
  const [novoEv, setNovoEv] = useState<
    Record<string, { nome: string; link: string; participacao: Participacao }>
  >({});

  const setores = [...dados.setores].sort((a, b) => a.ordem - b.ordem);

  function tratar(r: ResultadoAcao) {
    setPendingId(null);
    if (r.status === "ok") {
      setErro(null);
      router.refresh();
    } else if (r.status === "nao_autenticado") {
      setErro("Sua sessão expirou. Entre novamente para editar.");
    } else {
      setErro(r.mensagem ?? "Não foi possível salvar a alteração.");
    }
  }

  function run(id: string, fn: () => Promise<ResultadoAcao>) {
    setErro(null);
    setPendingId(id);
    startTransition(async () => tratar(await fn()));
  }

  function evForm(setorId: string) {
    return novoEv[setorId] ?? { nome: "", link: "", participacao: "A avaliar" };
  }
  function setEvForm(
    setorId: string,
    patch: Partial<{ nome: string; link: string; participacao: Participacao }>
  ) {
    setNovoEv((prev) => ({
      ...prev,
      [setorId]: { ...evForm(setorId), ...patch },
    }));
  }

  function onAddSetor() {
    const nome = novoSetor.trim();
    if (!nome) return;
    run("novo-setor", async () => {
      const r = await adicionarSetor(nome);
      if (r.status === "ok") setNovoSetor("");
      return r;
    });
  }

  function onAddEvento(setorId: string) {
    const f = evForm(setorId);
    if (!f.nome.trim()) return;
    run("novo-ev-" + setorId, async () => {
      const r = await adicionarEvento(setorId, f.nome, f.link, f.participacao);
      if (r.status === "ok")
        setNovoEv((prev) => ({
          ...prev,
          [setorId]: { nome: "", link: "", participacao: "A avaliar" },
        }));
      return r;
    });
  }

  return (
    <section className="section" id="avaliacao">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">
            [05] ONDE PODEMOS ESTAR. SUGESTÕES POR SETOR.
          </div>
          <h2 className="section-title">
            Onde podemos estar. <em>Sugestões por setor.</em>
          </h2>
        </div>
        <p className="section-intro">
          Eventos que a TecnoFink pode considerar participar, organizados por{" "}
          <strong>setor da indústria</strong>. Em cada setor, os eventos trazem o{" "}
          <strong>link da página</strong> e o tipo de participação pretendida
          (stand ou presença de equipe).
          {podeEditar
            ? " Clique nos campos para editar; adicione ou remova setores e eventos à vontade."
            : ""}
        </p>

        {erro ? <p className={styles.erro}>{erro}</p> : null}

        {setores.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Nenhum setor da indústria ainda</strong>
            {podeEditar
              ? "Adicione um setor abaixo para começar."
              : "Os setores aparecerão aqui assim que forem cadastrados."}
          </div>
        ) : (
          <div className={styles.lista}>
            {setores.map((setor) => (
              <SetorBloco
                key={setor.id}
                setor={setor}
                podeEditar={podeEditar}
                pendingId={pendingId}
                styles={styles}
                onEditarSetorNome={(nome) =>
                  run("setor-" + setor.id, () => editarSetor(setor.id, nome))
                }
                onRemoverSetor={() => {
                  const n = setor.eventos.length;
                  const msg =
                    n > 0
                      ? `Remover o setor "${setor.nome}" e seus ${n} evento(s)?`
                      : `Remover o setor "${setor.nome}"?`;
                  if (!confirm(msg)) return;
                  run("setor-" + setor.id, () => removerSetor(setor.id));
                }}
                onEditarEvento={(evId, campos) =>
                  run("ev-" + evId, () => editarEvento(evId, campos))
                }
                onRemoverEvento={(evId) =>
                  run("ev-" + evId, () => removerEvento(evId))
                }
                evForm={evForm(setor.id)}
                setEvForm={(patch) => setEvForm(setor.id, patch)}
                onAddEvento={() => onAddEvento(setor.id)}
              />
            ))}
          </div>
        )}

        {podeEditar ? (
          <div className={styles.addSetor}>
            <input
              type="text"
              value={novoSetor}
              onChange={(e) => setNovoSetor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddSetor();
              }}
              placeholder="Novo setor da indústria (ex: Papel e Celulose, Siderurgia, Saneamento…)"
            />
            <button
              type="button"
              className={`${styles.btnSm} ${styles.btnSmPrimary}`}
              onClick={onAddSetor}
              disabled={pendingId === "novo-setor"}
            >
              + Adicionar setor
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SetorBloco({
  setor,
  podeEditar,
  pendingId,
  styles,
  onEditarSetorNome,
  onRemoverSetor,
  onEditarEvento,
  onRemoverEvento,
  evForm,
  setEvForm,
  onAddEvento,
}: {
  setor: ProspSetor;
  podeEditar: boolean;
  pendingId: string | null;
  styles: Record<string, string>;
  onEditarSetorNome: (nome: string) => void;
  onRemoverSetor: () => void;
  onEditarEvento: (
    evId: string,
    campos: Partial<{
      nome: string;
      link: string;
      participacao: Participacao;
      obs: string;
    }>
  ) => void;
  onRemoverEvento: (evId: string) => void;
  evForm: { nome: string; link: string; participacao: Participacao };
  setEvForm: (
    patch: Partial<{ nome: string; link: string; participacao: Participacao }>
  ) => void;
  onAddEvento: () => void;
}) {
  const n = setor.eventos.length;
  const eventos = [...setor.eventos].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className={styles.setor}>
      <div className={styles.setorHead}>
        <span className={styles.setorTag}>Setor</span>
        {podeEditar ? (
          <span
            className={styles.setorNome}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              const v = e.currentTarget.textContent ?? "";
              if (v.trim() && v.trim() !== setor.nome) onEditarSetorNome(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          >
            {setor.nome}
          </span>
        ) : (
          <span className={styles.setorNome}>{setor.nome}</span>
        )}
        <span className={styles.count}>
          {n} {n === 1 ? "evento" : "eventos"}
        </span>
        {podeEditar ? (
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger} ${styles.setorDel}`}
            onClick={onRemoverSetor}
            disabled={pendingId === "setor-" + setor.id}
            title="Remover setor"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <div className={styles.eventos}>
        {eventos.length === 0 ? (
          <div className={styles.vazio}>
            {podeEditar
              ? "Nenhum evento neste setor ainda. Adicione abaixo."
              : "Nenhum evento neste setor ainda."}
          </div>
        ) : (
          eventos.map((ev) => (
            <EventoLinha
              key={ev.id}
              ev={ev}
              podeEditar={podeEditar}
              pendingId={pendingId}
              styles={styles}
              onEditar={(campos) => onEditarEvento(ev.id, campos)}
              onRemover={() => onRemoverEvento(ev.id)}
            />
          ))
        )}
      </div>

      {podeEditar ? (
        <div className={styles.addEv}>
          <input
            type="text"
            value={evForm.nome}
            onChange={(e) => setEvForm({ nome: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAddEvento();
            }}
            placeholder="Nome do evento"
          />
          <input
            type="url"
            value={evForm.link}
            onChange={(e) => setEvForm({ link: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAddEvento();
            }}
            placeholder="Link da página (https://…)"
          />
          <select
            value={evForm.participacao}
            onChange={(e) =>
              setEvForm({ participacao: e.target.value as Participacao })
            }
          >
            {PARTICIPACAO_OPCOES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.btnSm} ${styles.btnSmPrimary}`}
            onClick={onAddEvento}
            disabled={pendingId === "novo-ev-" + setor.id}
          >
            + Evento
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EventoLinha({
  ev,
  podeEditar,
  pendingId,
  styles,
  onEditar,
  onRemover,
}: {
  ev: ProspEvento;
  podeEditar: boolean;
  pendingId: string | null;
  styles: Record<string, string>;
  onEditar: (
    campos: Partial<{
      nome: string;
      link: string;
      participacao: Participacao;
      obs: string;
    }>
  ) => void;
  onRemover: () => void;
}) {
  const link = (ev.link ?? "").trim();
  const obs = (ev.obs ?? "").trim();
  const ocupado = pendingId === "ev-" + ev.id;

  if (!podeEditar) {
    return (
      <div className={styles.ev}>
        <div className={styles.evTop}>
          <span className={styles.evNome}>{ev.nome}</span>
          <span className={styles.partBadge}>{ev.participacao}</span>
        </div>
        <div className={styles.evLinkrow}>
          {link ? (
            <>
              <span className={styles.evLinkStatic}>{link}</span>
              <a
                className={styles.btnSm}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir ↗
              </a>
            </>
          ) : null}
        </div>
        {obs ? <p className={styles.evObsStatic}>{obs}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.ev}>
      <div className={styles.evTop}>
        <span
          className={styles.evNome}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const v = e.currentTarget.textContent ?? "";
            if (v.trim() && v.trim() !== ev.nome) onEditar({ nome: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {ev.nome}
        </span>
        <select
          className={styles.evPart}
          value={ev.participacao}
          onChange={(e) =>
            onEditar({ participacao: e.target.value as Participacao })
          }
          title="Tipo de participação"
        >
          {PARTICIPACAO_OPCOES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.evDel}
          onClick={onRemover}
          disabled={ocupado}
          title="Remover evento"
        >
          ✕
        </button>
      </div>
      <div className={styles.evLinkrow}>
        <input
          type="url"
          className={styles.evLink}
          defaultValue={link}
          placeholder="Link da página do evento (https://…)"
          onBlur={(e) => {
            if (e.currentTarget.value.trim() !== link)
              onEditar({ link: e.currentTarget.value });
          }}
        />
        {link ? (
          <a
            className={styles.btnSm}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir ↗
          </a>
        ) : null}
      </div>
      <input
        type="text"
        className={styles.evObs}
        defaultValue={obs}
        placeholder="Informações: data, local, contato, observações…"
        onBlur={(e) => {
          if (e.currentTarget.value.trim() !== obs)
            onEditar({ obs: e.currentTarget.value });
        }}
      />
    </div>
  );
}
