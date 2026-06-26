"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dados, Workshop, WorkshopProduto } from "./dados";
import {
  adicionarWorkshop,
  editarWorkshop,
  removerWorkshop,
  adicionarProduto,
  editarProduto,
  removerProduto,
  type ResultadoAcao,
} from "./acoes";
import styles from "./workshops.module.css";

type CampoWorkshop = "tema" | "organizador" | "local" | "data" | "obs";

export default function WorkshopsSection({
  dados,
  podeEditar,
}: {
  dados: Dados;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const workshops = [...dados.workshops].sort((a, b) => a.ordem - b.ordem);

  // Trata o resultado de uma ação: refresh em caso de ok, mensagem amigável senão.
  function tratar(r: ResultadoAcao) {
    if (r.status === "ok") {
      router.refresh();
    } else if (r.status === "nao_autenticado") {
      setErro("Sua sessão expirou. Entre novamente para editar.");
    } else {
      setErro(r.mensagem ?? "Não foi possível salvar a alteração.");
    }
  }

  function executar(fn: () => Promise<ResultadoAcao>) {
    setErro(null);
    setOcupado(true);
    startTransition(async () => {
      const r = await fn();
      setOcupado(false);
      tratar(r);
    });
  }

  function salvarCampo(w: Workshop, campo: CampoWorkshop, valor: string) {
    const atual = (w[campo] ?? "") as string;
    if (valor === atual) return; // nada mudou, evita roundtrip
    executar(() => editarWorkshop(w.id, campo, valor));
  }

  function salvarProduto(p: WorkshopProduto, valor: string) {
    if (valor.trim() === p.texto) return;
    executar(() => editarProduto(p.id, valor));
  }

  function CardLeitura(w: Workshop) {
    return (
      <div className={styles.card} key={w.id}>
        <div className={styles.head}>
          <p className={styles.temaLeitura}>
            {w.tema || "Workshop sem título"}
          </p>
        </div>
        <div className={styles.meta}>
          <div className={styles.field}>
            <label>Quem organizou</label>
            <p className={styles.fieldValor}>
              {w.organizador || (
                <span className={styles.fieldVazio}>—</span>
              )}
            </p>
          </div>
          <div className={styles.field}>
            <label>Onde foi</label>
            <p className={styles.fieldValor}>
              {w.local || <span className={styles.fieldVazio}>—</span>}
            </p>
          </div>
          <div className={styles.field}>
            <label>Data</label>
            <p className={styles.fieldValor}>
              {w.data || <span className={styles.fieldVazio}>—</span>}
            </p>
          </div>
        </div>
        <div className={styles.prodTitulo}>Produtos apresentados</div>
        <ul className={styles.prodLista}>
          {w.produtos.length ? (
            w.produtos.map((p) => (
              <li className={styles.prod} key={p.id}>
                <span className={styles.prodTxt}>{p.texto}</span>
              </li>
            ))
          ) : (
            <li className={styles.prodVazio}>Nenhum produto listado ainda.</li>
          )}
        </ul>
        {w.obs ? <p className={styles.fieldValor}>{w.obs}</p> : null}
      </div>
    );
  }

  function CardEdicao(w: Workshop) {
    return (
      <div className={styles.card} key={w.id}>
        <div className={styles.head}>
          <input
            className={styles.tema}
            defaultValue={w.tema}
            placeholder="Tema / título do workshop"
            onBlur={(e) => salvarCampo(w, "tema", e.target.value)}
          />
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger} ${styles.del}`}
            disabled={ocupado}
            title="Remover workshop"
            onClick={() => {
              if (
                window.confirm(
                  `Remover o workshop "${w.tema || "sem título"}"?`
                )
              ) {
                executar(() => removerWorkshop(w.id));
              }
            }}
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
        </div>
        <div className={styles.meta}>
          <div className={styles.field}>
            <label>Quem organizou</label>
            <input
              defaultValue={w.organizador ?? ""}
              placeholder="Organizador"
              onBlur={(e) => salvarCampo(w, "organizador", e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label>Onde foi</label>
            <input
              defaultValue={w.local ?? ""}
              placeholder="Local"
              onBlur={(e) => salvarCampo(w, "local", e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label>Data</label>
            <input
              defaultValue={w.data ?? ""}
              placeholder="ex: 12/03/2026"
              onBlur={(e) => salvarCampo(w, "data", e.target.value)}
            />
          </div>
        </div>
        <div className={styles.prodTitulo}>Produtos apresentados</div>
        <ul className={styles.prodLista}>
          {w.produtos.length ? (
            w.produtos.map((p) => (
              <li className={styles.prod} key={p.id}>
                <span
                  className={styles.prodTxt}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    salvarProduto(p, e.currentTarget.textContent ?? "")
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                >
                  {p.texto}
                </span>
                <button
                  type="button"
                  className={styles.prodDel}
                  title="Remover"
                  disabled={ocupado}
                  onClick={() => executar(() => removerProduto(p.id))}
                >
                  ✕
                </button>
              </li>
            ))
          ) : (
            <li className={styles.prodVazio}>Nenhum produto listado ainda.</li>
          )}
        </ul>
        <AdicionarProduto
          workshopId={w.id}
          ocupado={ocupado}
          onAdicionar={(txt) => executar(() => adicionarProduto(w.id, txt))}
        />
        <input
          className={styles.obs}
          defaultValue={w.obs ?? ""}
          placeholder="Observações (público, resultados, próximos passos…)"
          onBlur={(e) => salvarCampo(w, "obs", e.target.value)}
        />
      </div>
    );
  }

  return (
    <section className="section" id="workshops">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">
            [08] WORKSHOP 2026. REGISTRO DE REALIZAÇÕES.
          </div>
          <h2 className="section-title">
            Workshop 2026. <em>Registro de realizações.</em>
          </h2>
        </div>
        <p className="section-intro">
          {podeEditar
            ? "Histórico dos workshops: quem organizou, onde foi, a data e os produtos apresentados. Clique nos campos para editar; adicione ou remova workshops e produtos."
            : "Histórico dos workshops da Tecnofink: quem organizou, onde foi, a data e os produtos apresentados."}
        </p>

        {erro ? (
          <p className={`section-intro ${styles.erro}`}>{erro}</p>
        ) : null}

        <div className={styles.lista}>
          {workshops.length ? (
            workshops.map(podeEditar ? CardEdicao : CardLeitura)
          ) : (
            <div className={styles.emptyState}>
              <strong>Nenhum workshop registrado</strong>
              {podeEditar
                ? "Adicione abaixo o primeiro workshop."
                : "Ainda não há workshops registrados."}
            </div>
          )}
        </div>

        {podeEditar ? (
          <div className={styles.addWs}>
            <button
              type="button"
              className={`${styles.btnSm} ${styles.btnSmPrimary}`}
              disabled={ocupado}
              onClick={() => executar(() => adicionarWorkshop())}
            >
              + Adicionar workshop
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// Campo de adicionar produto (entrada controlada local, espelha o input do HTML).
function AdicionarProduto({
  workshopId,
  ocupado,
  onAdicionar,
}: {
  workshopId: string;
  ocupado: boolean;
  onAdicionar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");

  function adicionar() {
    const t = texto.trim();
    if (!t) return;
    onAdicionar(t);
    setTexto("");
  }

  return (
    <div className={styles.prodAdd}>
      <input
        type="text"
        id={`ws-prod-${workshopId}`}
        value={texto}
        placeholder="+ Produto apresentado"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            adicionar();
          }
        }}
      />
      <button
        type="button"
        className={styles.btnSm}
        disabled={ocupado}
        onClick={adicionar}
      >
        Adicionar
      </button>
    </div>
  );
}
