import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SisFrota — Secretaria Municipal de Saúde de Marabá",
  description:
    "Sistema de gestão da frota da Secretaria Municipal de Saúde de Marabá/PA. Em desenvolvimento.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
