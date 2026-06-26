"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dados, Brinde, BrindeUso } from "./dados";
import {
  adicionarBrinde,
  editarBrinde,
  removerBrinde,
  adicionarUso,
  editarUso,
  removerUso,
  type ResultadoAcao,
} from "./acoes";
import styles from "./brindes.module.css";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

function usado(b: Brinde): number {
  return (b.usos || []).reduce((s, u) => s + (Number(u.qtd) || 0), 0);
}
function saldo(b: Brinde): number {
  return (b.estoque_inicial != null ? b.estoque_inicial : 0) - usado(b);
}
function classeSaldo(b: Brinde): string {
  const inicial = b.estoque_inicial != null ? b.estoque_inicial : 0;
  const s = saldo(b);
  if (s < 0) return styles.saldoCrit;
  if (inicial > 0 && s <= inicial * 0.1) return styles.saldoWarn;
  return styles.saldoOk;
}

export default function BrindesSection({
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

  // Estado dos inputs de adição (novo brinde)
  const [novoNome, setNovoNome] = useState("");
  const [novaQtd, setNovaQtd] = useState("");
  // Inputs de adição de saída, por brinde
  const [usoMotivo, setUsoMotivo] = useState<Record<string, string>>({});
  const [usoQtd, setUsoQtd] = useState<Record<string, string>>({});

  const brindes = [...dados.brindes].sort((a, b) => a.ordem - b.ordem);

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

  function onAddBrinde() {
    const nome = novoNome.trim();
    if (!nome) return;
    let q: number | null = parseInt(novaQtd, 10);
    if (isNaN(q) || q < 0) q = null;
    setNovoNome("");
    setNovaQtd("");
    executar(() => adicionarBrinde(nome, q, brindes.length));
  }

  function onRemoverBrinde(b: Brinde) {
    if (
      !window.confirm(`Remover o brinde "${b.nome}" e seu histórico de saídas?`)
    )
      return;
    executar(() => removerBrinde(b.id));
  }

  function onEditarNome(b: Brinde, valor: string) {
    const limpo = valor.trim();
    if (!limpo || limpo === b.nome) return;
    executar(() => editarBrinde(b.id, { nome: limpo }));
  }

  function onEditarInicial(b: Brinde, valor: string) {
    const t = valor.trim();
    let v: number | null;
    if (t === "") v = null;
    else {
      const n = parseInt(t, 10);
      v = isNaN(n) || n < 0 ? 0 : n;
    }
    if (v === b.estoque_inicial) return;
    executar(() => editarBrinde(b.id, { estoque_inicial: v }));
  }

  function onAddUso(b: Brinde) {
    const motivo = (usoMotivo[b.id] || "").trim();
    let q = parseInt(usoQtd[b.id] || "", 10);
    if (isNaN(q) || q < 0) q = 0;
    if (!motivo && !q) return;
    setUsoMotivo((m) => ({ ...m, [b.id]: "" }));
    setUsoQtd((m) => ({ ...m, [b.id]: "" }));
    executar(() => adicionarUso(b.id, motivo, q, (b.usos || []).length));
  }

  function onEditarUsoMotivo(u: BrindeUso, valor: string) {
    const limpo = valor.trim();
    if (limpo === (u.motivo ?? "")) return;
    executar(() => editarUso(u.id, { motivo: limpo }));
  }

  function onEditarUsoQtd(u: BrindeUso, valor: string) {
    let v = parseInt(valor, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v === u.qtd) return;
    executar(() => editarUso(u.id, { qtd: v }));
  }

  function onRemoverUso(u: BrindeUso) {
    executar(() => removerUso(u.id));
  }

  function Card(b: Brinde) {
    const usos = b.usos || [];
    return (
      <div key={b.id} className={styles.card}>
        <div className={styles.head}>
          {podeEditar ? (
            <input
              className={styles.nome}
              defaultValue={b.nome}
              placeholder="Nome do brinde"
              onBlur={(e) => onEditarNome(b, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          ) : (
            <span className={styles.nomeStatic}>{b.nome}</span>
          )}
          {podeEditar ? (
            <button
              type="button"
              className={styles.del}
              disabled={salvando}
              onClick={() => onRemoverBrinde(b)}
              title="Remover brinde"
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

        <div className={styles.nums}>
          <div className={styles.numBox}>
            <label>Estoque inicial</label>
            {podeEditar ? (
              <input
                type="number"
                className={styles.inicial}
                min={0}
                defaultValue={b.estoque_inicial != null ? b.estoque_inicial : ""}
                placeholder="—"
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => onEditarInicial(b, e.target.value)}
              />
            ) : (
              <div className={styles.numVal}>
                {b.estoque_inicial != null ? fmtNum(b.estoque_inicial) : "—"}
              </div>
            )}
          </div>
          <div className={styles.numBox}>
            <label>Usado / saídas</label>
            <div className={styles.numVal}>{fmtNum(usado(b))}</div>
          </div>
          <div className={styles.numBox}>
            <label>Saldo atual</label>
            <div className={`${styles.numVal} ${classeSaldo(b)}`}>
              {fmtNum(saldo(b))}
            </div>
          </div>
        </div>

        <div className={styles.usosTitulo}>Saídas / uso</div>
        <div className={styles.usos}>
          {usos.length === 0 ? (
            <div className={styles.vazio}>Nenhuma saída registrada ainda.</div>
          ) : podeEditar ? (
            usos.map((u) => (
              <div key={u.id} className={styles.uso}>
                <input
                  className={styles.usoMotivo}
                  defaultValue={u.motivo ?? ""}
                  placeholder="Motivo (feira, consultor, visita…)"
                  onBlur={(e) => onEditarUsoMotivo(u, e.target.value)}
                />
                <input
                  className={styles.usoQtd}
                  type="number"
                  min={0}
                  defaultValue={u.qtd != null ? u.qtd : ""}
                  placeholder="0"
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => onEditarUsoQtd(u, e.target.value)}
                />
                <button
                  type="button"
                  className={styles.usoDel}
                  disabled={salvando}
                  onClick={() => onRemoverUso(u)}
                  title="Remover saída"
                >
                  ✕
                </button>
              </div>
            ))
          ) : (
            usos.map((u) => (
              <div key={u.id} className={styles.usoLeitura}>
                <span className={styles.usoLeituraMotivo}>
                  {u.motivo || "—"}
                </span>
                <span className={styles.usoLeituraQtd}>{fmtNum(u.qtd)}</span>
              </div>
            ))
          )}
        </div>

        {podeEditar ? (
          <div className={styles.addUso}>
            <input
              type="text"
              value={usoMotivo[b.id] ?? ""}
              placeholder="Motivo (ex: Feira Exposibram, consultor João, visita cliente X)"
              onChange={(e) =>
                setUsoMotivo((m) => ({ ...m, [b.id]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddUso(b);
              }}
            />
            <input
              type="number"
              min={0}
              value={usoQtd[b.id] ?? ""}
              placeholder="Qtd"
              onChange={(e) =>
                setUsoQtd((m) => ({ ...m, [b.id]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddUso(b);
              }}
            />
            <button
              type="button"
              className={styles.btnSm}
              disabled={salvando}
              onClick={() => onAddUso(b)}
            >
              + Saída
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="section" id="brindes">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">[06] BRINDES. ESTOQUE E USO.</div>
          <h2 className="section-title">
            Brindes. <em>Estoque e uso.</em>
          </h2>
        </div>
        <p className="section-intro">
          Controle do estoque de brindes. Para cada item, informe o{" "}
          <strong>estoque inicial</strong> e registre as <strong>saídas</strong>{" "}
          (motivo + quantidade — feira, solicitação de consultor, visita…). O{" "}
          <strong>saldo</strong> é calculado automaticamente.
        </p>

        {erro ? (
          <p className={`section-intro ${styles.erro}`}>{erro}</p>
        ) : null}

        {brindes.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Nenhum brinde cadastrado</strong>
            {podeEditar
              ? "Adicione um brinde abaixo."
              : "Os brindes aparecerão aqui assim que forem cadastrados."}
          </div>
        ) : (
          <div className={styles.lista}>{brindes.map(Card)}</div>
        )}

        {podeEditar ? (
          <div className={styles.addBrinde}>
            <input
              type="text"
              value={novoNome}
              placeholder="Novo brinde (ex: Chaveiros, Blocos, Sacolas…)"
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddBrinde();
              }}
            />
            <input
              type="number"
              min={0}
              value={novaQtd}
              placeholder="Estoque inicial"
              onChange={(e) => setNovaQtd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddBrinde();
              }}
            />
            <button
              type="button"
              className={`${styles.btnSm} ${styles.btnSmPrimary}`}
              disabled={salvando}
              onClick={onAddBrinde}
            >
              + Adicionar brinde
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
