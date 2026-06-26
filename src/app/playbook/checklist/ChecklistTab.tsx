"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Setor, Categoria, Marcacao } from "./tipos";
import {
  toggleMarcacao,
  setQtd,
  marcarVarios,
  type ResultadoAcao,
} from "./acoes";
import styles from "./checklist.module.css";

export default function ChecklistTab({
  eventoId,
  setores,
  categorias,
  marcacoes,
  podeEditar,
  onErro,
}: {
  eventoId: string;
  setores: Setor[];
  categorias: Categoria[];
  marcacoes: Record<string, Marcacao>; // [itemId] da feira selecionada
  podeEditar: boolean;
  onErro: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [colapsadas, setColapsadas] = useState<Record<string, boolean>>({});

  function tratar(r: ResultadoAcao) {
    setSalvando(false);
    if (r.status === "ok") {
      onErro(null);
      router.refresh();
    } else if (r.status === "nao_autenticado") {
      onErro("Sua sessão expirou. Entre novamente para editar.");
    } else {
      onErro(r.mensagem ?? "Não foi possível salvar a alteração.");
    }
  }
  function executar(fn: () => Promise<ResultadoAcao>) {
    onErro(null);
    setSalvando(true);
    fn().then(tratar);
  }

  const marcado = (itemId: string) => !!marcacoes[itemId]?.marcado;
  const qtdDe = (itemId: string) => marcacoes[itemId]?.qtd ?? null;

  function onToggle(itemId: string, valor: boolean) {
    executar(() => toggleMarcacao(eventoId, itemId, valor));
  }
  function onQtd(itemId: string, valor: string) {
    const t = valor.trim();
    let v: number | null;
    if (t === "") v = null;
    else {
      const n = parseInt(t, 10);
      v = isNaN(n) || n < 0 ? 0 : n;
    }
    if (v === qtdDe(itemId)) return;
    executar(() => setQtd(eventoId, itemId, v));
  }
  function onMarcarCategoria(cat: Categoria, valor: boolean) {
    executar(() =>
      marcarVarios(
        eventoId,
        cat.itens.map((i) => i.id),
        valor
      )
    );
  }

  const ordenarSetores = [...setores].sort((a, b) => a.ordem - b.ordem);
  const ordenarCats = [...categorias].sort((a, b) => a.ordem - b.ordem);
  const setorIds = new Set(ordenarSetores.map((s) => s.id));
  const soltas = ordenarCats.filter(
    (c) => !c.setor_id || !setorIds.has(c.setor_id)
  );

  if (categorias.length === 0 && setores.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>Sem categorias ainda</strong>
        As categorias e itens do checklist aparecerão aqui assim que forem
        cadastrados.
      </div>
    );
  }

  function CategoriaCard(cat: Categoria) {
    const collapsed = !!colapsadas[cat.id];
    const total = cat.itens.length;
    const marc = cat.itens.filter((i) => marcado(i.id)).length;
    const full = total > 0 && marc === total;
    return (
      <div key={cat.id} className={styles.categoria}>
        <div className={styles.catHeader}>
          <div className={styles.catHeaderLeft}>
            <button
              type="button"
              className={`${styles.catToggle} ${collapsed ? styles.collapsed : ""}`}
              title="Recolher/expandir"
              onClick={() =>
                setColapsadas((m) => ({ ...m, [cat.id]: !m[cat.id] }))
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className={styles.catNomeStatic}>{cat.nome}</span>
            <span className={`${styles.catCount} ${full ? styles.full : ""}`}>
              {marc}/{total}
            </span>
          </div>
          {podeEditar ? (
            <div className={styles.catActions}>
              <button
                type="button"
                className={styles.iconBtn}
                title="Marcar todos desta categoria"
                disabled={salvando || total === 0}
                onClick={() => onMarcarCategoria(cat, true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                title="Desmarcar todos desta categoria"
                disabled={salvando || total === 0}
                onClick={() => onMarcarCategoria(cat, false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
        <div className={`${styles.catItens} ${collapsed ? styles.collapsed : ""}`}>
          {total === 0 ? (
            <div className={styles.itemVazio}>Sem itens nesta categoria.</div>
          ) : (
            cat.itens.map((it) => (
              <div key={it.id} className={styles.itemRow}>
                <input
                  type="checkbox"
                  className={styles.itemCheck}
                  checked={marcado(it.id)}
                  disabled={!podeEditar || salvando}
                  onChange={(e) => onToggle(it.id, e.target.checked)}
                />
                {podeEditar ? (
                  <input
                    type="number"
                    className={styles.itemQtd}
                    min={0}
                    step={1}
                    defaultValue={qtdDe(it.id) ?? ""}
                    placeholder="qtd"
                    title="Quantidade que está sendo levada"
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => onQtd(it.id, e.target.value)}
                  />
                ) : qtdDe(it.id) != null ? (
                  <span className={styles.itemQtd} style={{ border: "none" }}>
                    {qtdDe(it.id)}
                  </span>
                ) : (
                  <span style={{ width: 52, flexShrink: 0 }} />
                )}
                <span
                  className={`${styles.itemNome} ${marcado(it.id) ? styles.marcado : ""}`}
                >
                  {it.nome}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.categorias}>
      {ordenarSetores.map((setor) => {
        const cats = ordenarCats.filter((c) => c.setor_id === setor.id);
        return (
          <div key={setor.id} className={styles.setorBloco}>
            <div className={styles.setorHead}>
              <span className={styles.setorTag}>Setor</span>
              <span className={styles.setorNomeStatic}>{setor.nome}</span>
              <span className={styles.setorCount}>
                {cats.length} {cats.length === 1 ? "divisão" : "divisões"}
              </span>
            </div>
            <div className={styles.setorCats}>
              {cats.length ? (
                cats.map(CategoriaCard)
              ) : (
                <div className={styles.setorVazio}>
                  Sem divisões neste setor ainda.
                </div>
              )}
            </div>
          </div>
        );
      })}
      {soltas.map(CategoriaCard)}
    </div>
  );
}
