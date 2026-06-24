import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Query-Land — Sichtbarkeit, die sich belegen lässt.",
  description:
    "SEO-Plattform für belegbare Sichtbarkeit: Rankings, technische Gesundheit und priorisierte Optimierungschancen — mit Quellnachweis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
