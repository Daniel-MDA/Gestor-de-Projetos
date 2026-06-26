"use client";

import { useRouter } from "next/navigation";
import type { Portal } from "./tipos";
import { salvarPortalCampo, type ResultadoAcao } from "./acoes";
import styles from "./checklist.module.css";

export default function PortalTab({
  eventoId,
  portal,
  estaLogado,
  podeEditar,
  onErro,
}: {
  eventoId: string;
  portal: Portal | undefined;
  estaLogado: boolean;
  podeEditar: boolean;
  onErro: (msg: string | null) => void;
}) {
  const router = useRouter();

  function tratar(r: ResultadoAcao) {
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
    fn().then(tratar);
  }

  if (!estaLogado) {
    return (
      <div className={styles.aviso}>
        <strong>Entre para ver o Portal do Expositor</strong>
        As credenciais (link, login e senha) ficam visíveis apenas para usuários
        autenticados.
      </div>
    );
  }

  const link = portal?.link ?? "";
  const login = portal?.login ?? "";
  const senha = portal?.senha ?? "";

  function onSalvar(campo: "link" | "login" | "senha", atual: string, valor: string) {
    if (valor.trim() === atual) return;
    executar(() => salvarPortalCampo(eventoId, campo, valor));
  }

  return (
    <div className={`${styles.logCard} ${styles.full} ${styles.portalCard}`}>
      <h4>🔑 Acesso ao Portal do Expositor</h4>
      <p className={styles.logDesc}>
        Link, login e senha do portal do expositor desta feira — para a equipe
        consultar como acessar.
      </p>

      <label className={styles.logLabel}>Link do portal</label>
      <div className={styles.logRow}>
        {podeEditar ? (
          <input
            type="url"
            className={styles.logField}
            placeholder="https://…"
            defaultValue={link}
            onBlur={(e) => onSalvar("link", link, e.target.value)}
          />
        ) : link ? (
          <a
            className={styles.logLeitura}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link}
          </a>
        ) : (
          <span className={styles.logLeituraVazio}>Sem link.</span>
        )}
        {link ? (
          <a
            className={`${styles.btnSm} ${styles.primary}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir portal ↗
          </a>
        ) : null}
      </div>

      <div className={styles.portalCred}>
        <div className={styles.portalField}>
          <label className={styles.logLabel}>Login / usuário</label>
          {podeEditar ? (
            <input
              type="text"
              className={styles.logField}
              placeholder="login"
              defaultValue={login}
              onBlur={(e) => onSalvar("login", login, e.target.value)}
            />
          ) : (
            <div className={login ? styles.logLeitura : styles.logLeituraVazio}>
              {login || "—"}
            </div>
          )}
        </div>
        <div className={styles.portalField}>
          <label className={styles.logLabel}>Senha</label>
          {podeEditar ? (
            <input
              type="text"
              className={styles.logField}
              placeholder="senha"
              defaultValue={senha}
              onBlur={(e) => onSalvar("senha", senha, e.target.value)}
            />
          ) : (
            <div className={senha ? styles.logLeitura : styles.logLeituraVazio}>
              {senha || "—"}
            </div>
          )}
        </div>
      </div>
      <p className={styles.portalAviso}>
        Estas informações são sensíveis e visíveis apenas para usuários
        autenticados do playbook.
      </p>
    </div>
  );
}
