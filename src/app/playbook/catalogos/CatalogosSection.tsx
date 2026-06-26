"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Dados,
  Catalogo,
  EventoCatalogo,
  GrupoCatalogo,
} from "./tipos";
import { GRUPO_OPCOES, LIMIAR_ATENCAO } from "./tipos";
import {
  adicionarCatalogo,
  removerCatalogo,
  editarEstoque,
  editarConsumo,
  type ResultadoAcao,
} from "./acoes";
import styles from "./catalogos.module.css";

const fmtNum = (n: number) => Number(n).toLocaleString("pt-BR");

// ── Cálculos derivados (replicam EXATAMENTE as funções do HTML) ──────────────

// consumo futuro de cada evento, na ordem das colunas.
function consumoFuturoDe(p: Catalogo, eventos: EventoCatalogo[]): number[] {
  return eventos.map((ev) => Number(p.consumoPorEvento[ev.id] ?? 0));
}
// consumo do FBCC (já realizado) = consumo anual - futuro total.
function fbccDe(p: Catalogo, eventos: EventoCatalogo[]): number {
  return (
    p.consumo_anual -
    consumoFuturoDe(p, eventos).reduce((s, x) => s + x, 0)
  );
}
// consumo anual = FBCC + futuro (recalcula se o usuário editar).
function consumoAnualDe(p: Catalogo, eventos: EventoCatalogo[]): number {
  return (
    fbccDe(p, eventos) +
    consumoFuturoDe(p, eventos).reduce((s, x) => s + x, 0)
  );
}
// consumo futuro total (soma dos eventos por vir).
function futuroDe(p: Catalogo, eventos: EventoCatalogo[]): number {
  return consumoFuturoDe(p, eventos).reduce((s, x) => s + x, 0);
}
// saldo projetado ao final = estoque - consumo futuro total.
function calcSaldo(p: Catalogo, eventos: EventoCatalogo[]): number {
  return p.estoque - futuroDe(p, eventos);
}
function calcCompra(p: Catalogo, eventos: EventoCatalogo[]): number {
  const s = calcSaldo(p, eventos);
  return s < 0 ? -s : 0;
}
function calcStatus(p: Catalogo, eventos: EventoCatalogo[]): string {
  const s = calcSaldo(p, eventos);
  if (s < 0) return "CRÍTICO";
  if (s < LIMIAR_ATENCAO) return "ATENÇÃO";
  return "SUFICIENTE";
}
// projeção: saldo após CADA evento + índice do 1º evento em que fica negativo.
function projetar(
  p: Catalogo,
  eventos: EventoCatalogo[]
): { saldos: number[]; idxNeg: number } {
  let saldo = p.estoque;
  const cons = consumoFuturoDe(p, eventos);
  const saldos: number[] = [];
  let idxNeg = -1;
  for (let i = 0; i < cons.length; i++) {
    saldo -= cons[i];
    saldos.push(saldo);
    if (idxNeg === -1 && saldo < 0) idxNeg = i;
  }
  return { saldos, idxNeg };
}

export default function CatalogosSection({
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
  const [acordeaoAberto, setAcordeaoAberto] = useState(false);

  // Inputs de adição (novo catálogo)
  const [novoNome, setNovoNome] = useState("");
  const [novoEstoque, setNovoEstoque] = useState("");
  const [novoGrupo, setNovoGrupo] = useState<GrupoCatalogo>("gerais");

  const eventos = [...dados.eventos].sort((a, b) => a.ordem - b.ordem);
  const catalogos = [...dados.catalogos].sort((a, b) => a.ordem - b.ordem);
  const gerais = catalogos.filter((c) => c.grupo === "gerais");
  const powerpoxi = catalogos.filter((c) => c.grupo === "powerpoxi");

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

  function onAddCatalogo() {
    const nome = novoNome.trim();
    if (!nome) return;
    let est = parseInt(novoEstoque, 10);
    if (isNaN(est) || est < 0) est = 0;
    const grupo = novoGrupo;
    const ordem = catalogos.filter((c) => c.grupo === grupo).length;
    setNovoNome("");
    setNovoEstoque("");
    executar(() => adicionarCatalogo(nome, grupo, est, ordem));
  }

  function onRemover(p: Catalogo) {
    if (!window.confirm(`Remover o catálogo "${p.nome}"?`)) return;
    executar(() => removerCatalogo(p.id));
  }

  function onEditarEstoque(p: Catalogo, valor: string) {
    let v = parseInt(valor, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v === p.estoque) return;
    executar(() => editarEstoque(p.id, v));
  }

  function onEditarConsumo(p: Catalogo, ev: EventoCatalogo, valor: string) {
    let v = parseInt(valor, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v === Number(p.consumoPorEvento[ev.id] ?? 0)) return;
    executar(() => editarConsumo(p.id, ev.id, v));
  }

  // ── Tabela de PROJEÇÃO (saldo após cada evento + "comprar antes de") ───────
  function TabelaProjecao({ lista }: { lista: Catalogo[] }) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.proj}>
          <thead>
            <tr>
              <th className={styles.prod}>Produto</th>
              <th>
                Estoque
                <br />
                atual
              </th>
              {eventos.map((ev) => (
                <th key={ev.id}>
                  Após {ev.nome}
                  {ev.data ? (
                    <span className={styles.evDate}>{ev.data}</span>
                  ) : null}
                </th>
              ))}
              <th className={`${styles.prod} ${styles.prodStatic}`}>
                Comprar antes de
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const { saldos, idxNeg } = projetar(p, eventos);
              return (
                <tr key={p.id}>
                  <td className={styles.prod}>
                    {p.nome}
                    {podeEditar && p.is_custom ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className={styles.catDel}
                          disabled={salvando}
                          onClick={() => onRemover(p)}
                          title="Remover catálogo"
                        >
                          ✕
                        </button>
                      </>
                    ) : null}
                  </td>
                  <td className={styles.estoque}>
                    {podeEditar ? (
                      <input
                        type="number"
                        className={styles.estoqueInput}
                        min={0}
                        step={1}
                        defaultValue={p.estoque}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => onEditarEstoque(p, e.target.value)}
                        title="Clique para editar o estoque atual"
                      />
                    ) : (
                      fmtNum(p.estoque)
                    )}
                  </td>
                  {saldos.map((s, i) => (
                    <td
                      key={eventos[i].id}
                      className={`${styles.bal} ${s < 0 ? styles.neg : styles.pos}`}
                    >
                      {fmtNum(s)}
                    </td>
                  ))}
                  <td className={styles.deadline}>
                    {idxNeg === -1 ? (
                      <span className={styles.dlOk}>✓ Estoque suficiente</span>
                    ) : (
                      <>
                        <span className={styles.dlBuy}>
                          Antes de {eventos[idxNeg].nome}
                        </span>
                        <span className={styles.dlSub}>
                          {eventos[idxNeg].data
                            ? `${eventos[idxNeg].data} · `
                            : ""}
                          comprar {fmtNum(calcCompra(p, eventos))} un
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Tabela de CONSUMO PREVISTO por evento (FBCC + colunas editáveis) ───────
  function TabelaConsumo({ lista }: { lista: Catalogo[] }) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.proj}>
          <thead>
            <tr>
              <th className={styles.prod}>Produto</th>
              <th>
                FBCC<span className={styles.evDate}>12/05</span>
              </th>
              {eventos.map((ev) => (
                <th key={ev.id}>
                  {ev.nome}
                  {ev.data ? (
                    <span className={styles.evDate}>{ev.data}</span>
                  ) : null}
                </th>
              ))}
              <th>
                Consumo
                <br />
                anual
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td className={styles.prod}>{p.nome}</td>
                <td
                  className={`${styles.bal} ${styles.pos}`}
                  title="Consumo no FBCC (já realizado)"
                >
                  {fmtNum(fbccDe(p, eventos))}
                </td>
                {eventos.map((ev) => (
                  <td key={ev.id} className={styles.estoque}>
                    {podeEditar ? (
                      <input
                        type="number"
                        className={styles.estoqueInput}
                        min={0}
                        step={1}
                        defaultValue={Number(p.consumoPorEvento[ev.id] ?? 0)}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => onEditarConsumo(p, ev, e.target.value)}
                        title="Consumo previsto neste evento"
                      />
                    ) : (
                      fmtNum(Number(p.consumoPorEvento[ev.id] ?? 0))
                    )}
                  </td>
                ))}
                <td className={`${styles.bal} ${styles.balTotal}`}>
                  {fmtNum(consumoAnualDe(p, eventos))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Resumo (4 cards) ────────────────────────────────────────────────────
  const estoqueTotal = catalogos.reduce((s, p) => s + p.estoque, 0);
  const consumoTotal = catalogos.reduce(
    (s, p) => s + consumoAnualDe(p, eventos),
    0
  );
  const necessidadeCompra = catalogos.reduce(
    (s, p) => s + calcCompra(p, eventos),
    0
  );
  const criticos = catalogos.filter(
    (p) => calcStatus(p, eventos) === "CRÍTICO"
  ).length;

  const resumo = [
    {
      num: fmtNum(estoqueTotal),
      lbl: "Estoque atual total (pós-FBCC)",
      crit: false,
    },
    { num: fmtNum(consumoTotal), lbl: "Consumo previsto 2026", crit: false },
    {
      num: fmtNum(necessidadeCompra),
      lbl: "Necessidade total de compra",
      crit: necessidadeCompra > 0,
    },
    {
      num: String(criticos),
      lbl: "Produtos em estado crítico",
      crit: criticos > 0,
    },
  ];

  const semDados = catalogos.length === 0;

  return (
    <section className="section" id="catalogos">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">
            [02] ESTOQUE DE CATÁLOGOS 2026. O QUE VAI FALTAR.
          </div>
          <h2 className="section-title">
            Estoque de catálogos 2026. <em>O que vai faltar.</em>
          </h2>
        </div>
        <p className="section-intro">
          Posição do estoque após o FBCC (12/05), projetada evento a evento até
          o fim do ano — igual à planilha. Cada coluna mostra quanto{" "}
          <strong>sobra depois daquele evento</strong>; quando fica{" "}
          <strong style={{ color: "var(--crit)" }}>vermelho</strong>, o estoque
          acabou e a compra precisa ser feita <strong>antes</strong> dele. A
          coluna <strong>“Comprar antes de”</strong> indica a data-limite.
          {podeEditar ? (
            <>
              {" "}
              Edite o <strong>Estoque atual</strong> (campo azul) e toda a
              projeção e as datas se recalculam.
            </>
          ) : null}
        </p>

        {erro ? (
          <p className={`section-intro ${styles.erro}`}>{erro}</p>
        ) : null}

        {/* Resumo */}
        <div className={styles.resumo}>
          {resumo.map((c, i) => (
            <div key={i} className={styles.resumoCard}>
              <div
                className={`${styles.resumoNum} ${c.crit ? styles.crit : ""}`}
              >
                {c.num}
              </div>
              <div className={styles.resumoLbl}>{c.lbl}</div>
            </div>
          ))}
        </div>

        {semDados ? (
          <div className={styles.emptyState}>
            <strong>Nenhum catálogo cadastrado</strong>
            {podeEditar
              ? "Adicione um catálogo abaixo."
              : "Os catálogos aparecerão aqui assim que forem cadastrados."}
          </div>
        ) : (
          <>
            {/* Tabela GERAIS */}
            <div className={styles.bloco}>
              <div className={styles.blocoHead}>
                <span className={styles.blocoTag}>Catálogos Gerais</span>
              </div>
              <TabelaProjecao lista={gerais} />
            </div>

            {/* Tabela POWERPOXI */}
            <div className={styles.bloco}>
              <div className={styles.blocoHead}>
                <span className={styles.blocoTag}>Catálogos PowerPoxi</span>
              </div>
              <TabelaProjecao lista={powerpoxi} />
            </div>
            <p className={styles.scrollHint}>
              ↔ Arraste a tabela para o lado para ver todos os eventos.
            </p>
          </>
        )}

        {/* Adicionar catálogo */}
        {podeEditar ? (
          <div className={styles.addCatalogo}>
            <input
              type="text"
              value={novoNome}
              placeholder="Novo catálogo (ex: Novo produto…)"
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddCatalogo();
              }}
            />
            <input
              type="number"
              min={0}
              value={novoEstoque}
              placeholder="Estoque atual"
              onChange={(e) => setNovoEstoque(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddCatalogo();
              }}
            />
            <select
              value={novoGrupo}
              onChange={(e) => setNovoGrupo(e.target.value as GrupoCatalogo)}
            >
              {GRUPO_OPCOES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.btnSm}
              disabled={salvando}
              onClick={onAddCatalogo}
            >
              + Adicionar catálogo
            </button>
          </div>
        ) : null}

        {/* Acordeão: Consumo previsto por evento */}
        {!semDados ? (
          <div className={styles.accordion}>
            <button
              type="button"
              className={`${styles.accHead} ${acordeaoAberto ? styles.aberto : ""}`}
              aria-expanded={acordeaoAberto}
              onClick={() => setAcordeaoAberto((v) => !v)}
            >
              <span className={styles.accTitulo}>
                Consumo previsto por evento
              </span>
              <span className={styles.accSub}>
                a base da projeção{podeEditar ? " — editável" : ""}
              </span>
              <svg
                className={styles.accArrow}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {acordeaoAberto ? (
              <div className={styles.accBody}>
                <p className={styles.accDesc}>
                  Quanto de cada catálogo se prevê consumir em cada evento. A
                  coluna <strong>FBCC</strong> (já realizado) é histórica; as
                  demais{podeEditar ? " são editáveis e, ao mudar," : ""}{" "}
                  recalculam a projeção e os totais acima.
                </p>
                <div className={styles.bloco}>
                  <div className={styles.blocoHead}>
                    <span className={styles.blocoTag}>Catálogos Gerais</span>
                  </div>
                  <TabelaConsumo lista={gerais} />
                </div>
                <div className={styles.bloco}>
                  <div className={styles.blocoHead}>
                    <span className={styles.blocoTag}>Catálogos PowerPoxi</span>
                  </div>
                  <TabelaConsumo lista={powerpoxi} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
