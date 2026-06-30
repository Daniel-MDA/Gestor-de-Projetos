import type { Metadata } from "next";
import "./playbook-theme.css";

// Bricolage Grotesque, Manrope e JetBrains Mono são carregadas no layout raiz
// e ficam disponíveis como variáveis CSS.

export const metadata: Metadata = {
  title: "Playbook 2026 — Tecnofink",
  description: "Playbook de eventos e marketing da Tecnofink",
};

export default function PlaybookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="playbook-root">{children}</div>;
}
