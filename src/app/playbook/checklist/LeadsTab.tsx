"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Leads, LeadManual, LeadOrigem } from "./tipos";
import { ORIGEM_OPCOES } from "./tipos";
import {
  salvarLeadsCampo,
  addLeadManual,
  editarLeadManual,
  removerLeadManual,
  salvarLeadsPlanilhaAnexo,
  removerLeadsPlanilhaAnexo,
  type ResultadoAcao,
} from "./acoes";
import UploadCampo from "../_shared/UploadCampo";
import { BUCKET_LEADS } from "../_shared/storage";
import styles from "./checklist.module.css";

export default function LeadsTab({
  eventoId,
  eventoNome,
  leads,
  estaLogado,
  podeEditar,
  onErro,
}: {
  eventoId: string;
  eventoNome: string;
  leads: Leads | undefined;
  estaLogado: boolean;
  podeEditar: boolean;
  onErro: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

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

  const planilhaLink = leads?.planilha_link ?? "";
  const planilhaPath = leads?.planilha_storage_path ?? null;
  const planilhaNome = leads?.planilha_nome ?? null;
  const manualLink = leads?.manual_planilha_link ?? "";
  const manuais = [...(leads?.manuais ?? [])].sort((a, b) => a.ordem - b.ordem);

  function onSalvarLink(
    campo: "planilha_link" | "manual_planilha_link",
    atual: string,
    valor: string
  ) {
    if (valor.trim() === atual) return;
    executar(() => salvarLeadsCampo(eventoId, campo, valor));
  }
  function onEditarLead(
    lead: LeadManual,
    campo: "nome" | "empresa" | "cargo" | "email" | "telefone" | "obs" | "origem",
    valor: string
  ) {
    const atual = (lead[campo] ?? "") as string;
    if (valor === atual) return;
    executar(() => editarLeadManual(lead.id, campo, valor));
  }

  // Exporta os leads manuais da feira selecionada como CSV (gerado no cliente,
  // baixado via Blob). Só-logado, pois são dados pessoais (PII / LGPD).
  function onExportarCsv() {
    if (manuais.length === 0) return;
    const cab = [
      "Nome",
      "Empresa",
      "Cargo",
      "E-mail",
      "Telefone",
      "Origem",
      "Observações",
    ];
    const esc = (v: string | null | undefined) =>
      '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const linhas = [cab.map(esc).join(";")];
    for (const m of manuais) {
      linhas.push(
        [m.nome, m.empresa, m.cargo, m.email, m.telefone, m.origem, m.obs]
          .map(esc)
          .join(";")
      );
    }
    const csv = "﻿" + linhas.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug =
      (eventoNome || "evento").replace(/[^\w]+/g, "-").toLowerCase() || "evento";
    a.download = "leads-" + slug + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.grid}>
      {/* Planilha do coletor (link público) */}
      <div className={`${styles.logCard} ${styles.full}`}>
        <h4>📊 Planilha do coletor de leads</h4>
        <p className={styles.logDesc}>
          Link da planilha que você recebe do coletor de leads do evento (Drive,
          OneDrive…).
        </p>
        <label className={styles.logLabel}>Link da planilha</label>
        <div className={styles.logRow}>
          {podeEditar ? (
            <input
              type="url"
              className={styles.logField}
              placeholder="https://…"
              defaultValue={planilhaLink}
              onBlur={(e) =>
                onSalvarLink("planilha_link", planilhaLink, e.target.value)
              }
            />
          ) : planilhaLink ? (
            <a
              className={styles.logLeitura}
              href={planilhaLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {planilhaLink}
            </a>
          ) : (
            <span className={styles.logLeituraVazio}>Sem link.</span>
          )}
          {planilhaLink ? (
            <a
              className={styles.btnSm}
              href={planilhaLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir ↗
            </a>
          ) : null}
        </div>
        {estaLogado ? (
          <>
            <label className={styles.logLabel} style={{ marginTop: 14 }}>
              Ou anexe o arquivo (.xlsx, .xls, .csv)
            </label>
            <UploadCampo
              bucket={BUCKET_LEADS}
              pathPrefix={"leads/" + eventoId}
              publico={false}
              podeEditar={podeEditar}
              accept=".xlsx,.xls,.csv"
              storagePath={planilhaPath}
              nomeArquivo={planilhaNome}
              onSalvar={(sp, nm) => salvarLeadsPlanilhaAnexo(eventoId, sp, nm)}
              onRemover={() => removerLeadsPlanilhaAnexo(eventoId)}
            />
          </>
        ) : null}
      </div>

      {/* Captação manual — PII, só-logado */}
      <div className={`${styles.logCard} ${styles.full}`}>
        <div className={styles.leadsManualHead}>
          <h4 style={{ margin: 0 }}>✍️ Captação manual</h4>
          {estaLogado ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
              <span className={styles.leadsCount}>
                {manuais.length} {manuais.length === 1 ? "lead" : "leads"}
              </span>
              <button
                type="button"
                className={styles.btnSm}
                title="Exportar os leads manuais como planilha (.csv)"
                disabled={manuais.length === 0}
                onClick={onExportarCsv}
              >
                ⤓ Exportar CSV
              </button>
            </div>
          ) : null}
        </div>
        <p className={styles.logDesc}>
          Leads coletados por cartão de visita ou pelo aplicativo. Contém dados
          pessoais.
        </p>

        {!estaLogado ? (
          <div className={styles.aviso}>
            <strong>Entre para ver os leads</strong>
            Os dados pessoais dos leads (nome, e-mail, telefone) são visíveis
            apenas para usuários autenticados.
          </div>
        ) : (
          <>
            <label className={styles.logLabel}>
              Link da planilha de leads manuais (opcional)
            </label>
            <div className={styles.logRow} style={{ marginBottom: 4 }}>
              {podeEditar ? (
                <input
                  type="url"
                  className={styles.logField}
                  placeholder="https://…"
                  defaultValue={manualLink}
                  onBlur={(e) =>
                    onSalvarLink("manual_planilha_link", manualLink, e.target.value)
                  }
                />
              ) : manualLink ? (
                <a
                  className={styles.logLeitura}
                  href={manualLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {manualLink}
                </a>
              ) : (
                <span className={styles.logLeituraVazio}>Sem link.</span>
              )}
              {manualLink ? (
                <a
                  className={styles.btnSm}
                  href={manualLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir ↗
                </a>
              ) : null}
            </div>

            <div className={styles.leadsSep}>
              <span>leads cadastrados</span>
            </div>

            <div className={styles.leadsLista}>
              {manuais.length === 0 ? (
                <div className={styles.leadsVazio}>
                  Nenhum lead cadastrado ainda.
                </div>
              ) : (
                manuais.map((m, i) =>
                  podeEditar ? (
                    <div key={m.id} className={styles.leadCard}>
                      <div className={styles.leadCardHead}>
                        <span className={styles.leadNum}>#{i + 1}</span>
                        <select
                          className={styles.leadOrigem}
                          title="Origem do lead"
                          defaultValue={m.origem}
                          onChange={(e) =>
                            onEditarLead(m, "origem", e.target.value as LeadOrigem)
                          }
                        >
                          {ORIGEM_OPCOES.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={styles.leadDel}
                          title="Remover lead"
                          disabled={salvando}
                          onClick={() => executar(() => removerLeadManual(m.id))}
                        >
                          ✕
                        </button>
                      </div>
                      <div className={styles.leadFields}>
                        <input
                          defaultValue={m.nome ?? ""}
                          placeholder="Nome"
                          onBlur={(e) => onEditarLead(m, "nome", e.target.value)}
                        />
                        <input
                          defaultValue={m.empresa ?? ""}
                          placeholder="Empresa"
                          onBlur={(e) => onEditarLead(m, "empresa", e.target.value)}
                        />
                        <input
                          defaultValue={m.cargo ?? ""}
                          placeholder="Cargo"
                          onBlur={(e) => onEditarLead(m, "cargo", e.target.value)}
                        />
                        <input
                          type="email"
                          defaultValue={m.email ?? ""}
                          placeholder="E-mail"
                          onBlur={(e) => onEditarLead(m, "email", e.target.value)}
                        />
                        <input
                          defaultValue={m.telefone ?? ""}
                          placeholder="Telefone"
                          onBlur={(e) => onEditarLead(m, "telefone", e.target.value)}
                        />
                      </div>
                      <input
                        className={styles.leadObs}
                        defaultValue={m.obs ?? ""}
                        placeholder="Observações (interesse, próximo passo…)"
                        onBlur={(e) => onEditarLead(m, "obs", e.target.value)}
                      />
                    </div>
                  ) : (
                    <div key={m.id} className={styles.leadLeitura}>
                      <div className={styles.nome}>{m.nome || "—"}</div>
                      <div className={styles.linha}>
                        {[m.empresa, m.cargo].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div className={styles.linha}>
                        {[m.email, m.telefone].filter(Boolean).join(" · ")}
                      </div>
                      <div className={styles.linha}>
                        <em>{m.origem}</em>
                        {m.obs ? ` — ${m.obs}` : ""}
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            {podeEditar ? (
              <button
                type="button"
                className={`${styles.btnSm} ${styles.primary}`}
                style={{ marginTop: 14 }}
                disabled={salvando}
                onClick={() =>
                  executar(() => addLeadManual(eventoId, manuais.length))
                }
              >
                + Adicionar lead
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
