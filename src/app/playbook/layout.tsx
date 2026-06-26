import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./playbook-theme.css";

// Fonte de títulos do playbook (identidade da Fernanda). Manrope e JetBrains Mono
// já são carregadas no layout raiz e ficam disponíveis como variáveis CSS.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Playbook 2026 — Tecnofink",
  description: "Playbook de eventos e marketing da Tecnofink",
};

export default function PlaybookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${bricolage.variable} playbook-root`}>{children}</div>;
}
