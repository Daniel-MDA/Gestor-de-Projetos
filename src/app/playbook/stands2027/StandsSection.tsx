"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dados, Stand, StandStatus, StandDocSlot } from "./tipos";
import { STAND_STATUS_OPCOES, STAND_DOC_SLOTS } from "./tipos";
import {
  adicionarStand,
  editarStand,
  removerStand,
  salvarStandDocLink,
  type ResultadoAcao,
} from "./acoes";
import styles from "./stands2027.module.css";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function classeStatus(s: StandStatus): string {
  if (s === "Confirmado / Pago") return styles.ok;
  if (s === "Reservado") return styles.warn;
  if (s === "Orçamento solicitado") return styles.info;
  return styles.todo;
}

export default function StandsSection({
  dados,
  podeEditar,
}: {
  dados: Dados;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const stands = [...dados.stands].sort((a, b) => a.ordem - b.ordem);

  // Cards de resumo derivados (calculados no cliente).
  const total = stands.reduce((s, e) => s + (Number(e.valor) || 0), 0);
  const confirmados = stands.filter(
    (e) => e.status === "Confirmado / Pago"
  ).length;

  function tratar(r: ResultadoAcao) {
    setSalvando(false);
    if (r.status === "ok") {
      setErro(null);
      router.refresh();
    } else if (r.status === "nao_autenticado") {
      setErro("Sua sessão expirou. Entre novamente para editar.");
    } else {
      setErro(r.mensagem ?? "Não foi possível salvar a alteração.");
    }
  }
  function executar(fn: () => Promise<ResultadoAcao>) {
    setErro(null);
    setSalvando(true);
    startTransition(async () => tratar(await fn()));
  }

  function onAddStand() {
    executar(() => adicionarStand(stands.length));
  }

  function onRemoverStand(e: Stand) {
    if (
      !window.confirm(
        `Remover o evento "${e.nome || "sem nome"}" e seus documentos?`
      )
    )
      return;
    executar(() => removerStand(e.id));
  }

  function onEditarTexto(
    e: Stand,
    campo: "nome" | "local" | "data" | "data_limite" | "obs",
    valor: string
  ) {
    const atual = (e[campo] ?? "") as string;
    if (valor.trim() === atual.trim()) return;
    executar(() => editarStand(e.id, { [campo]: valor }));
  }

  function onEditarStatus(e: Stand, valor: string) {
    const status = valor as StandStatus;
    if (status === e.status) return;
    executar(() => editarStand(e.id, { status }));
  }

  function onEditarValor(e: Stand, valor: string) {
    const t = valor.trim();
    let v: number | null;
    if (t === "") v = null;
    else {
      const n = parseFloat(t.replace(",", "."));
      v = isNaN(n) || n < 0 ? null : n;
    }
    if (v === e.valor) return;
    executar(() => editarStand(e.id, { valor: v }));
  }

  function onSalvarDocLink(e: Stand, slot: StandDocSlot, valor: string) {
    const atual = e.docs.find((d) => d.slot === slot)?.link ?? "";
    if (valor.trim() === atual.trim()) return;
    executar(() => salvarStandDocLink(e.id, slot, valor));
  }

  function Card(e: Stand) {
    return (
      <div key={e.id} className={styles.card}>
        <div className={styles.top}>
          {podeEditar ? (
            <input
              className={styles.nome}
              defaultValue={e.nome ?? ""}
              placeholder="Nome do evento"
              onBlur={(ev) => onEditarTexto(e, "nome", ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") ev.currentTarget.blur();
              }}
            />
          ) : (
            <span className={styles.nomeStatic}>{e.nome || "Sem nome"}</span>
          )}

          {podeEditar ? (
            <select
              className={`${styles.status} ${classeStatus(e.status)}`}
              defaultValue={e.status}
              onChange={(ev) => onEditarStatus(e, ev.target.value)}
            >
              {STAND_STATUS_OPCOES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <span className={`${styles.statusStatic} ${classeStatus(e.status)}`}>
              {e.status}
            </span>
          )}

          {podeEditar ? (
            <button
              type="button"
              className={styles.del}
              disabled={salvando}
              onClick={() => onRemoverStand(e)}
              title="Remover evento"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className={styles.meta}>
          <div className={styles.field}>
            <label>Local</label>
            {podeEditar ? (
              <input
                defaultValue={e.local ?? ""}
                placeholder="Cidade"
                onBlur={(ev) => onEditarTexto(e, "local", ev.target.value)}
              />
            ) : (
              <div className={styles.fieldVal}>{e.local || "—"}</div>
            )}
          </div>
          <div className={styles.field}>
            <label>Data do evento</label>
            {podeEditar ? (
              <input
                defaultValue={e.data ?? ""}
                placeholder="ex: Maio/2027"
                onBlur={(ev) => onEditarTexto(e, "data", ev.target.value)}
              />
            ) : (
              <div className={styles.fieldVal}>{e.data || "—"}</div>
            )}
          </div>
          <div className={styles.field}>
            <label>Data limite de compra</label>
            {podeEditar ? (
              <input
                defaultValue={e.data_limite ?? ""}
                placeholder="ex: 31/01/2027"
                onBlur={(ev) =>
                  onEditarTexto(e, "data_limite", ev.target.value)
                }
              />
            ) : (
              <div className={styles.fieldVal}>{e.data_limite || "—"}</div>
            )}
          </div>
          <div className={styles.field}>
            <label>Valor do stand (R$)</label>
            {podeEditar ? (
              <input
                type="number"
                min={0}
                step="0.01"
                defaultValue={e.valor != null ? e.valor : ""}
                placeholder="—"
                onFocus={(ev) => ev.currentTarget.select()}
                onBlur={(ev) => onEditarValor(e, ev.target.value)}
              />
            ) : (
              <div className={styles.fieldVal}>
                {e.valor != null ? fmtBRL(e.valor) : "—"}
              </div>
            )}
          </div>
        </div>

        {podeEditar ? (
          <input
            className={styles.obs}
            defaultValue={e.obs ?? ""}
            placeholder="Observações (área, fornecedor, prazo de pagamento…)"
            onBlur={(ev) => onEditarTexto(e, "obs", ev.target.value)}
          />
        ) : e.obs ? (
          <div className={`${styles.obs} ${styles.fieldVal}`}>{e.obs}</div>
        ) : null}

        <div className={styles.docsTitulo}>
          Planta &amp; projeto do stand sugerido
        </div>
        <div className={styles.docs}>
          {STAND_DOC_SLOTS.map(({ slot, titulo }) => {
            const doc = e.docs.find((d) => d.slot === slot);
            const link = doc?.link ?? "";
            return (
              <div key={slot} className={styles.doc}>
                <div className={styles.docTag}>{titulo}</div>
                {podeEditar ? (
                  <input
                    type="url"
                    className={styles.docLink}
                    defaultValue={link}
                    placeholder="Cole o link (Drive, PDF…)"
                    onBlur={(ev) => onSalvarDocLink(e, slot, ev.target.value)}
                  />
                ) : null}
                {link ? (
                  <a
                    className={styles.docAbrir}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir ↗
                  </a>
                ) : !podeEditar ? (
                  <div className={styles.docVazio}>Sem documento</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="section" id="stands2027">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">
            [07] STANDS 2027. FEIRAS E EVENTOS.
          </div>
          <h2 className="section-title">
            Stands 2027. <em>Feiras e eventos que vamos participar.</em>
          </h2>
        </div>
        <p className="section-intro">
          Planejamento das feiras e eventos de <strong>2027</strong> e o
          andamento da <strong>compra dos stands</strong>. Registre o status, o
          valor e as observações de cada um, além da{" "}
          <strong>planta e do projeto</strong> do stand sugerido (por link).
        </p>

        {erro ? (
          <p className={`section-intro ${styles.erro}`}>{erro}</p>
        ) : null}

        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <div className={styles.resumoNum}>{stands.length}</div>
            <div className={styles.resumoLbl}>Eventos em 2027</div>
          </div>
          <div className={styles.resumoCard}>
            <div className={styles.resumoNum}>{confirmados}</div>
            <div className={styles.resumoLbl}>Stands confirmados</div>
          </div>
          <div className={styles.resumoCard}>
            <div className={styles.resumoNum}>{fmtBRL(total)}</div>
            <div className={styles.resumoLbl}>Investimento previsto</div>
          </div>
        </div>

        {stands.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Nenhum evento de 2027 ainda</strong>
            {podeEditar
              ? "Adicione abaixo as feiras que vão entrar no planejamento."
              : "As feiras aparecerão aqui assim que forem cadastradas."}
          </div>
        ) : (
          <div className={styles.lista}>{stands.map(Card)}</div>
        )}

        {podeEditar ? (
          <div className={styles.addStand}>
            <button
              type="button"
              className={`${styles.btnSm} ${styles.btnSmPrimary}`}
              disabled={salvando}
              onClick={onAddStand}
            >
              + Adicionar evento
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
