import type { Metadata } from "next";
import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tecnofink CRM",
  description: "Sistema de gestão de projetos da Tecnofink",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
  className={`${manrope.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}
  style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
  suppressHydrationWarning
>
        {children}
      </body>
    </html>
  );
}