"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Logistica } from "./tipos";
import { DOC_SLOTS } from "./tipos";
import {
  salvarLogisticaCampo,
  salvarDocLink,
  addCusto,
  editarCusto,
  removerCusto,
  addColaborador,
  removerColaborador,
  type ResultadoAcao,
} from "./acoes";
import styles from "./checklist.module.css";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function LogisticaTab({
  eventoId,
  logistica,
  podeEditar,
  onErro,
}: {
  eventoId: string;
  logistica: Logistica | undefined;
  podeEditar: boolean;
  onErro: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [novoColab, setNovoColab] = useState("");
  const [custoDesc, setCustoDesc] = useState("");
  const [custoValor, setCustoValor] = useState("");

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

  const colaboradores = logistica?.colaboradores ?? [];
  const custos = [...(logistica?.custos ?? [])].sort((a, b) => a.ordem - b.ordem);
  const totalCusto = custos.reduce((s, c) => s + (Number(c.valor) || 0), 0);

  const docLink = (slot: string) =>
    logistica?.docs.find((d) => d.slot === slot)?.link ?? "";

  function onSalvarCampo(campo: "hotel" | "transporte" | "obs", valor: string) {
    const atual = (logistica?.[campo] ?? "") as string;
    if (valor === atual) return;
    executar(() => salvarLogisticaCampo(eventoId, campo, valor));
  }
  function onSalvarDocLink(slot: string, valor: string) {
    if (valor.trim() === docLink(slot)) return;
    executar(() =>
      salvarDocLink(
        eventoId,
        slot as "stand" | "buffet" | "organizacao" | "planta",
        valor
      )
    );
  }
  function onAddColab() {
    const nome = novoColab.trim();
    if (!nome) return;
    setNovoColab("");
    executar(() => addColaborador(eventoId, nome));
  }
  function onAddCusto() {
    const d = custoDesc.trim();
    let v = parseFloat(custoValor);
    if (isNaN(v) || v < 0) v = 0;
    if (!d && !v) return;
    setCustoDesc("");
    setCustoValor("");
    executar(() => addCusto(eventoId, d, v, custos.length));
  }

  return (
    <div className={styles.grid}>
      {/* Documentos fixos (apenas link) */}
      {DOC_SLOTS.map((slot) => (
        <div key={slot.key} className={styles.logCard}>
          <h4>
            {slot.icon} {slot.titulo}
          </h4>
          <p className={styles.logDesc}>{slot.desc}</p>
          <label className={styles.logLabel}>Link (PDF / pasta)</label>
          <div className={styles.logRow}>
            {podeEditar ? (
              <input
                type="url"
                className={styles.logField}
                placeholder="https://…"
                defaultValue={docLink(slot.key)}
                onBlur={(e) => onSalvarDocLink(slot.key, e.target.value)}
              />
            ) : docLink(slot.key) ? (
              <a
                className={styles.logLeitura}
                href={docLink(slot.key)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {docLink(slot.key)}
              </a>
            ) : (
              <span className={styles.logLeituraVazio}>Sem link.</span>
            )}
            {docLink(slot.key) ? (
              <a
                className={styles.btnSm}
                href={docLink(slot.key)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir ↗
              </a>
            ) : null}
          </div>
        </div>
      ))}

      {/* Hotel */}
      <div className={styles.logCard}>
        <h4>🏨 Hotel definido</h4>
        <p className={styles.logDesc}>Hotel da equipe durante a feira.</p>
        <label className={styles.logLabel}>Nome / endereço / reserva</label>
        {podeEditar ? (
          <textarea
            className={styles.logField}
            placeholder="Ex: Hotel X — Av. tal, 123 · check-in 26/05 · reserva nº 998877"
            defaultValue={logistica?.hotel ?? ""}
            onBlur={(e) => onSalvarCampo("hotel", e.target.value)}
          />
        ) : (
          <div className={logistica?.hotel ? styles.logLeitura : styles.logLeituraVazio}>
            {logistica?.hotel || "Sem informação."}
          </div>
        )}
      </div>

      {/* Transporte */}
      <div className={styles.logCard}>
        <h4>🚐 Meio de transporte</h4>
        <p className={styles.logDesc}>Como a equipe e o material chegam até lá.</p>
        <label className={styles.logLabel}>Transporte</label>
        {podeEditar ? (
          <textarea
            className={styles.logField}
            placeholder="Ex: Voo TF1234 (26/05 08h) · van do aeroporto · carreta do estande sai dia 24/05"
            defaultValue={logistica?.transporte ?? ""}
            onBlur={(e) => onSalvarCampo("transporte", e.target.value)}
          />
        ) : (
          <div
            className={logistica?.transporte ? styles.logLeitura : styles.logLeituraVazio}
          >
            {logistica?.transporte || "Sem informação."}
          </div>
        )}
      </div>

      {/* Colaboradores */}
      <div className={`${styles.logCard} ${styles.full}`}>
        <h4>👥 Colaboradores presentes</h4>
        <p className={styles.logDesc}>Quem da equipe estará no evento.</p>
        <div className={styles.colabList}>
          {colaboradores.length ? (
            colaboradores.map((nome, i) => (
              <span key={`${nome}-${i}`} className={styles.colabTag}>
                {nome}
                {podeEditar ? (
                  <button
                    type="button"
                    title="Remover"
                    disabled={salvando}
                    onClick={() => executar(() => removerColaborador(eventoId, i))}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ) : null}
              </span>
            ))
          ) : (
            <span className={styles.colabVazio}>
              Nenhum colaborador adicionado ainda.
            </span>
          )}
        </div>
        {podeEditar ? (
          <div className={styles.logRow}>
            <input
              type="text"
              className={styles.logField}
              placeholder="Nome do colaborador"
              value={novoColab}
              onChange={(e) => setNovoColab(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddColab();
              }}
            />
            <button
              type="button"
              className={`${styles.btnSm} ${styles.primary}`}
              disabled={salvando}
              onClick={onAddColab}
            >
              + Adicionar
            </button>
          </div>
        ) : null}
      </div>

      {/* Custos */}
      <div className={`${styles.logCard} ${styles.full}`}>
        <h4>💰 Custo do evento</h4>
        <p className={styles.logDesc}>
          Liste os custos descritos do evento. O <strong>custo total</strong> é
          somado automaticamente.
        </p>
        <div className={styles.custoTable}>
          <div className={`${styles.custoRow} ${styles.head}`}>
            <div>Descrição</div>
            <div>Valor (R$)</div>
            <div></div>
          </div>
          {custos.length ? (
            custos.map((c) =>
              podeEditar ? (
                <div key={c.id} className={styles.custoRow}>
                  <input
                    className={styles.cst}
                    defaultValue={c.descricao}
                    placeholder="Descrição"
                    onBlur={(e) => {
                      if (e.target.value.trim() === c.descricao) return;
                      executar(() =>
                        editarCusto(c.id, { descricao: e.target.value })
                      );
                    }}
                  />
                  <input
                    className={`${styles.cst} ${styles.num}`}
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={c.valor}
                    placeholder="0,00"
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      const nv = isNaN(v) || v < 0 ? 0 : v;
                      if (nv === Number(c.valor)) return;
                      executar(() => editarCusto(c.id, { valor: nv }));
                    }}
                  />
                  <button
                    type="button"
                    className={styles.custoDel}
                    title="Remover"
                    disabled={salvando}
                    onClick={() => executar(() => removerCusto(c.id))}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div key={c.id} className={styles.custoRow}>
                  <div className={styles.custoCell}>{c.descricao || "—"}</div>
                  <div className={`${styles.custoCell} ${styles.num}`}>
                    {fmtBRL(c.valor)}
                  </div>
                  <div />
                </div>
              )
            )
          ) : (
            <div className={styles.custoVazio}>Nenhum custo lançado ainda.</div>
          )}
          <div className={styles.custoTotal}>
            <span>Custo total</span>
            <strong>{fmtBRL(totalCusto)}</strong>
          </div>
        </div>
        {podeEditar ? (
          <div className={styles.logRow} style={{ marginTop: 12 }}>
            <input
              className={styles.logField}
              placeholder="Descrição (ex: Locação do espaço, montagem do stand…)"
              value={custoDesc}
              onChange={(e) => setCustoDesc(e.target.value)}
            />
            <input
              className={styles.logField}
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              style={{ maxWidth: 150 }}
              value={custoValor}
              onChange={(e) => setCustoValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddCusto();
              }}
            />
            <button
              type="button"
              className={`${styles.btnSm} ${styles.primary}`}
              disabled={salvando}
              onClick={onAddCusto}
            >
              + Adicionar
            </button>
          </div>
        ) : null}
      </div>

      {/* Observações */}
      <div className={`${styles.logCard} ${styles.full}`}>
        <h4>📝 Observações</h4>
        <p className={styles.logDesc}>
          Qualquer informação extra da logística da feira.
        </p>
        {podeEditar ? (
          <textarea
            className={styles.logField}
            placeholder="Horários de montagem, contatos da organização, pendências…"
            defaultValue={logistica?.obs ?? ""}
            onBlur={(e) => onSalvarCampo("obs", e.target.value)}
          />
        ) : (
          <div className={logistica?.obs ? styles.logLeitura : styles.logLeituraVazio}>
            {logistica?.obs || "Sem observações."}
          </div>
        )}
      </div>
    </div>
  );
}
