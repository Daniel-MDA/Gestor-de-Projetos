"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dados, Associacao, Beneficio } from "./dados";
import {
  adicionarAssociacao,
  removerAssociacao,
  editarNomeAssociacao,
  editarDescontoAssociacao,
  adicionarBeneficio,
  editarBeneficio,
  removerBeneficio,
  type ResultadoAcao,
} from "./acoes";
import styles from "./associacoes.module.css";

export default function AssociacoesSection({
  dados,
  podeEditar,
}: {
  dados: Dados;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novaAssoc, setNovaAssoc] = useState("");
  // texto do input "+ novo benefício" por associação
  const [novoBenef, setNovoBenef] = useState<Record<string, string>>({});

  const associacoes = [...dados.associacoes].sort((a, b) => a.ordem - b.ordem);

  function rodar(fn: () => Promise<ResultadoAcao>) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (r.status === "ok") router.refresh();
      else if (r.status === "nao_autenticado")
        setErro("Sua sessão expirou. Entre novamente para editar.");
      else setErro(r.mensagem ?? "Não foi possível salvar a alteração.");
    });
  }

  function addAssociacao() {
    const nome = novaAssoc.trim();
    if (!nome) return;
    const ordem =
      associacoes.length > 0
        ? Math.max(...associacoes.map((a) => a.ordem)) + 1
        : 0;
    setNovaAssoc("");
    rodar(() => adicionarAssociacao(nome, ordem));
  }

  function delAssociacao(a: Associacao) {
    if (!confirm(`Remover a associação "${a.nome}"?`)) return;
    rodar(() => removerAssociacao(a.id));
  }

  function salvarNome(a: Associacao, valor: string) {
    const novo = valor.trim();
    if (!novo || novo === a.nome) return;
    rodar(() => editarNomeAssociacao(a.id, novo));
  }

  function salvarDesconto(a: Associacao, valor: string) {
    const t = valor.trim();
    const novo: number | null = t === "" ? null : Number(t.replace(",", "."));
    // sem mudança real
    if (novo === a.desconto) return;
    if (novo !== null && Number.isNaN(novo)) return;
    rodar(() => editarDescontoAssociacao(a.id, novo));
  }

  function addBenef(a: Associacao) {
    const txt = (novoBenef[a.id] ?? "").trim();
    if (!txt) return;
    const ordem =
      a.beneficios.length > 0
        ? Math.max(...a.beneficios.map((b) => b.ordem)) + 1
        : 0;
    setNovoBenef((s) => ({ ...s, [a.id]: "" }));
    rodar(() => adicionarBeneficio(a.id, txt, ordem));
  }

  function salvarBenef(b: Beneficio, valor: string) {
    const novo = valor.trim();
    if (novo === b.texto) return;
    // texto vazio remove (espelha o HTML original)
    rodar(() => editarBeneficio(b.id, novo));
  }

  function delBenef(b: Beneficio) {
    rodar(() => removerBeneficio(b.id));
  }

  return (
    <section className="section" id="associacoes">
      <div className="pb-container">
        <div className="section-head">
          <div className="section-num">[04] ASSOCIAÇÕES &amp; CONVÊNIOS.</div>
          <h2 className="section-title">
            Associações &amp; convênios. <em>Benefícios e descontos.</em>
          </h2>
        </div>
        <p className="section-intro">
          As associações em que a TecnoFink participa e o que cada uma oferece —
          o <strong>desconto</strong> na compra de stands e eventos e a lista de{" "}
          <strong>benefícios</strong>.
          {podeEditar
            ? " Clique nos campos para editar; adicione ou remova associações e benefícios à vontade."
            : ""}
        </p>

        {erro ? (
          <p className="section-intro">
            <span className={styles.erro}>{erro}</span>
          </p>
        ) : null}

        <div className={styles.lista}>
          {associacoes.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>Nenhuma associação cadastrada</strong>
              {podeEditar
                ? "Adicione uma associação abaixo."
                : "Ainda não há associações cadastradas."}
            </div>
          ) : (
            associacoes.map((a) => (
              <Card
                key={a.id}
                a={a}
                podeEditar={podeEditar}
                novoBenef={novoBenef[a.id] ?? ""}
                setNovoBenef={(v) =>
                  setNovoBenef((s) => ({ ...s, [a.id]: v }))
                }
                onSalvarNome={salvarNome}
                onSalvarDesconto={salvarDesconto}
                onDelAssoc={delAssociacao}
                onAddBenef={addBenef}
                onSalvarBenef={salvarBenef}
                onDelBenef={delBenef}
              />
            ))
          )}
        </div>

        {podeEditar ? (
          <div className={styles.addAssoc}>
            <input
              type="text"
              value={novaAssoc}
              onChange={(e) => setNovaAssoc(e.target.value)}
              placeholder="Nome da nova associação (ex: ABRAMAN, IBP…)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAssociacao();
                }
              }}
            />
            <button
              type="button"
              className={`${styles.btnSm} ${styles.primary}`}
              onClick={addAssociacao}
            >
              + Adicionar associação
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Card({
  a,
  podeEditar,
  novoBenef,
  setNovoBenef,
  onSalvarNome,
  onSalvarDesconto,
  onDelAssoc,
  onAddBenef,
  onSalvarBenef,
  onDelBenef,
}: {
  a: Associacao;
  podeEditar: boolean;
  novoBenef: string;
  setNovoBenef: (v: string) => void;
  onSalvarNome: (a: Associacao, valor: string) => void;
  onSalvarDesconto: (a: Associacao, valor: string) => void;
  onDelAssoc: (a: Associacao) => void;
  onAddBenef: (a: Associacao) => void;
  onSalvarBenef: (b: Beneficio, valor: string) => void;
  onDelBenef: (b: Beneficio) => void;
}) {
  const beneficios = [...a.beneficios].sort((x, y) => x.ordem - y.ordem);
  const descTexto = a.desconto != null ? formatarDesconto(a.desconto) : "—";

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        {podeEditar ? (
          <span
            className={styles.nome}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onSalvarNome(a, e.currentTarget.textContent ?? "")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          >
            {a.nome}
          </span>
        ) : (
          <span className={styles.nomeRo}>{a.nome}</span>
        )}

        <div className={styles.desc}>
          <div className={styles.descVal}>
            {podeEditar ? (
              <input
                type="number"
                className={styles.descInput}
                min={0}
                max={100}
                step={0.5}
                defaultValue={a.desconto != null ? a.desconto : ""}
                placeholder="—"
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => onSalvarDesconto(a, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <span className={styles.descNum}>{descTexto}</span>
            )}
            <span className={styles.descPct}>%</span>
          </div>
          <span className={styles.descLabel}>
            desconto em
            <br />
            stands e eventos
          </span>
        </div>

        {podeEditar ? (
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.danger} ${styles.del}`}
            onClick={() => onDelAssoc(a)}
            title="Remover associação"
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

      <div className={styles.benefTitulo}>Benefícios</div>
      <ul className={styles.benefLista}>
        {beneficios.length > 0 ? (
          beneficios.map((b) => (
            <li key={b.id} className={styles.benef}>
              {podeEditar ? (
                <>
                  <span
                    className={styles.benefTxt}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onSalvarBenef(b, e.currentTarget.textContent ?? "")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                  >
                    {b.texto}
                  </span>
                  <button
                    type="button"
                    className={styles.benefDel}
                    onClick={() => onDelBenef(b)}
                    title="Remover benefício"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className={styles.benefTxt}>{b.texto}</span>
              )}
            </li>
          ))
        ) : (
          <li className={styles.vazio}>Nenhum benefício listado ainda.</li>
        )}
      </ul>

      {podeEditar ? (
        <div className={styles.foot}>
          <input
            type="text"
            value={novoBenef}
            onChange={(e) => setNovoBenef(e.target.value)}
            placeholder="+ Novo benefício (ex: Estande com 15% off, mídia no site…)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddBenef(a);
              }
            }}
          />
          <button
            type="button"
            className={styles.btnSm}
            onClick={() => onAddBenef(a)}
          >
            Adicionar benefício
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Mostra inteiros sem casas (15) e fracionados com até 2 casas (12.5).
function formatarDesconto(v: number): string {
  return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
}
