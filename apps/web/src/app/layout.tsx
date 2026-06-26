import type { Metadata } from "next";
import { Literata, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Editorial Tech typography (B-1) — the brand signature:
 * Erzählung serif (Literata) · Bedienung sans (Inter) · Messwert mono (JetBrains Mono).
 * Exposed as CSS variables consumed in globals.css. See DOCS/design/brand-identity.md §4.
 */
const literata = Literata({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Query-Land — Sichtbarkeit, die sich belegen lässt.",
  description:
    "SEO-Plattform für belegbare Sichtbarkeit: Rankings, technische Gesundheit und priorisierte Optimierungschancen — mit Quellnachweis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${literata.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
