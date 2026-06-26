"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Setor, Categoria, Marcacao } from "./tipos";
import {
  toggleMarcacao,
  setQtd,
  marcarVarios,
  addSetor,
  renomearSetor,
  removerSetor,
  addCategoria,
  renomearCategoria,
  removerCategoria,
  addItem,
  renomearItem,
  removerItem,
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
  const [novoSetor, setNovoSetor] = useState("");
  const [novaCat, setNovaCat] = useState<Record<string, string>>({}); // [setorId|"_soltas"]
  const [novoItem, setNovoItem] = useState<Record<string, string>>({}); // [categoriaId]

  const SOLTAS_KEY = "_soltas";

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

  // ── Edição da árvore (só quando podeEditar) ────────────────────────────────
  function onAddSetor() {
    const nome = novoSetor.trim();
    if (!nome) return;
    setNovoSetor("");
    executar(() => addSetor(nome));
  }
  function onRenomearSetor(setorId: string, atual: string, valor: string) {
    const nome = valor.trim();
    if (!nome || nome === atual) return;
    executar(() => renomearSetor(setorId, nome));
  }
  function onRemoverSetor(setor: Setor, qtdCats: number) {
    const msg =
      qtdCats > 0
        ? `Remover o setor "${setor.nome}"?\n\nAs ${qtdCats} divisão(ões) dele voltam a ficar sem setor — nada é apagado.`
        : `Remover o setor "${setor.nome}"?`;
    if (!confirm(msg)) return;
    executar(() => removerSetor(setor.id));
  }
  function onAddCategoria(setorKey: string, setorId: string | null) {
    const nome = (novaCat[setorKey] ?? "").trim();
    if (!nome) return;
    setNovaCat((m) => ({ ...m, [setorKey]: "" }));
    executar(() => addCategoria(nome, setorId));
  }
  function onRenomearCategoria(catId: string, atual: string, valor: string) {
    const nome = valor.trim();
    if (!nome || nome === atual) return;
    executar(() => renomearCategoria(catId, nome));
  }
  function onRemoverCategoria(cat: Categoria) {
    if (
      !confirm(`Remover a categoria "${cat.nome}" e todos os seus itens?`)
    )
      return;
    executar(() => removerCategoria(cat.id));
  }
  function onAddItem(catId: string) {
    const nome = (novoItem[catId] ?? "").trim();
    if (!nome) return;
    setNovoItem((m) => ({ ...m, [catId]: "" }));
    executar(() => addItem(catId, nome));
  }
  function onRenomearItem(itemId: string, atual: string, valor: string) {
    const nome = valor.trim();
    if (!nome || nome === atual) return;
    executar(() => renomearItem(itemId, nome));
  }
  function onRemoverItem(itemId: string) {
    executar(() => removerItem(itemId));
  }

  const ordenarSetores = [...setores].sort((a, b) => a.ordem - b.ordem);
  const ordenarCats = [...categorias].sort((a, b) => a.ordem - b.ordem);
  const setorIds = new Set(ordenarSetores.map((s) => s.id));
  const soltas = ordenarCats.filter(
    (c) => !c.setor_id || !setorIds.has(c.setor_id)
  );

  const arvoreVazia = categorias.length === 0 && setores.length === 0;
  if (arvoreVazia && !podeEditar) {
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
            {podeEditar ? (
              <input
                className={styles.catNome}
                defaultValue={cat.nome}
                title="Renomear categoria"
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => onRenomearCategoria(cat.id, cat.nome, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            ) : (
              <span className={styles.catNomeStatic}>{cat.nome}</span>
            )}
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
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.danger}`}
                title="Remover categoria"
                disabled={salvando}
                onClick={() => onRemoverCategoria(cat)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 001 1h8a1 1 0 001-1V6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
                {podeEditar ? (
                  <input
                    className={`${styles.itemNome} ${styles.catNome}`}
                    style={{ marginLeft: 0 }}
                    defaultValue={it.nome}
                    title="Renomear item"
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => onRenomearItem(it.id, it.nome, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                ) : (
                  <span
                    className={`${styles.itemNome} ${marcado(it.id) ? styles.marcado : ""}`}
                  >
                    {it.nome}
                  </span>
                )}
                {podeEditar ? (
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.danger} ${styles.deleteBtn}`}
                    title="Remover item"
                    disabled={salvando}
                    onClick={() => onRemoverItem(it.id)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
        {podeEditar ? (
          <div className={styles.catFooter}>
            <div className={styles.addItemInput}>
              <input
                type="text"
                placeholder="Novo item…"
                value={novoItem[cat.id] ?? ""}
                onChange={(e) =>
                  setNovoItem((m) => ({ ...m, [cat.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAddItem(cat.id);
                }}
              />
              <button
                type="button"
                className={styles.btnSm}
                disabled={salvando}
                onClick={() => onAddItem(cat.id)}
              >
                + Item
              </button>
            </div>
          </div>
        ) : null}
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
              {podeEditar ? (
                <input
                  className={styles.setorNome}
                  defaultValue={setor.nome}
                  title="Renomear setor"
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) =>
                    onRenomearSetor(setor.id, setor.nome, e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              ) : (
                <span className={styles.setorNomeStatic}>{setor.nome}</span>
              )}
              <span className={styles.setorCount}>
                {cats.length} {cats.length === 1 ? "divisão" : "divisões"}
              </span>
              {podeEditar ? (
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.danger} ${styles.setorDel}`}
                  title="Remover setor"
                  disabled={salvando}
                  onClick={() => onRemoverSetor(setor, cats.length)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 001 1h8a1 1 0 001-1V6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
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
            {podeEditar ? (
              <div className={styles.setorFoot}>
                <input
                  type="text"
                  placeholder="Nova divisão neste setor…"
                  value={novaCat[setor.id] ?? ""}
                  onChange={(e) =>
                    setNovaCat((m) => ({ ...m, [setor.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onAddCategoria(setor.id, setor.id);
                  }}
                />
                <button
                  type="button"
                  className={styles.btnSm}
                  disabled={salvando}
                  onClick={() => onAddCategoria(setor.id, setor.id)}
                >
                  + Categoria
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      {soltas.map(CategoriaCard)}

      {podeEditar ? (
        <div className={styles.addBar}>
          <div className={styles.addItemInput}>
            <input
              type="text"
              placeholder="Nova categoria sem setor…"
              value={novaCat[SOLTAS_KEY] ?? ""}
              onChange={(e) =>
                setNovaCat((m) => ({ ...m, [SOLTAS_KEY]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddCategoria(SOLTAS_KEY, null);
              }}
            />
            <button
              type="button"
              className={styles.btnSm}
              disabled={salvando}
              onClick={() => onAddCategoria(SOLTAS_KEY, null)}
            >
              + Categoria
            </button>
          </div>
          <div className={styles.addSetor}>
            <input
              type="text"
              placeholder="Novo setor…"
              value={novoSetor}
              onChange={(e) => setNovoSetor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddSetor();
              }}
            />
            <button
              type="button"
              className={`${styles.btnSm} ${styles.primary}`}
              disabled={salvando}
              onClick={onAddSetor}
            >
              + Setor
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
