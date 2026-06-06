import type { SourceConfidence } from "./integrations.js";

// Search-Performance-Intelligence (§5 Modul 4). GSC liefert die Query×Page-Matrix (Klasse B);
// daraus werden drei Gap-Analysen abgeleitet: Striking-Distance, CTR-Gap, Kannibalisierung.

export type SearchPerformanceDevice = "desktop" | "mobile" | "tablet";

export interface SearchPerformanceRow {
  id: string;
  projectId: string;
  siteId: string;
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  market: string;
  capturedAt: string;
  sourceConfidence: SourceConfidence;
}

// Minimaler Zeilen-Slice, den die reinen Analyzer brauchen (DB-unabhängig, damit testbar).
export interface SearchPerformanceMetricRow {
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Transparente CTR-Benchmark-Kurve nach Position. Bewusst ein dokumentierter Heuristik-Wert,
// KEINE gemessene Quelle — er dient nur zur Gap-Berechnung. Die gemessene CTR selbst stammt
// aus GSC (Klasse B); die abgeleitete Lücke erbt diese Confidence.
const CTR_BENCHMARK: Record<number, number> = {
  1: 0.28,
  2: 0.15,
  3: 0.11,
  4: 0.08,
  5: 0.07,
  6: 0.05,
  7: 0.04,
  8: 0.032,
  9: 0.028,
  10: 0.025
};

export function expectedCtrForPosition(position: number): number {
  if (!Number.isFinite(position) || position < 1) return 0;
  const rounded = Math.round(position);
  if (rounded <= 10) return CTR_BENCHMARK[rounded] ?? 0.025;
  if (rounded <= 20) return 0.015;
  if (rounded <= 30) return 0.008;
  return 0.004;
}

export interface StrikingDistanceItem {
  query: string;
  pageUrl: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface StrikingDistanceOptions {
  minPosition?: number;
  maxPosition?: number;
  minImpressions?: number;
  limit?: number;
}

// "Striking distance": Queries knapp außerhalb der Top-10 (Default Position 11–20), nach
// Impressionen sortiert — die günstigsten Hebel, um in die Top-10 zu rücken.
export function analyzeStrikingDistance(rows: SearchPerformanceMetricRow[], options: StrikingDistanceOptions = {}): StrikingDistanceItem[] {
  const minPosition = options.minPosition ?? 11;
  const maxPosition = options.maxPosition ?? 20;
  const minImpressions = options.minImpressions ?? 0;
  const items = rows
    .filter((row) => row.position >= minPosition && row.position <= maxPosition && row.impressions >= minImpressions)
    .map((row) => ({ query: row.query, pageUrl: row.pageUrl, position: row.position, impressions: row.impressions, clicks: row.clicks, ctr: row.ctr }))
    .sort((left, right) => right.impressions - left.impressions || left.position - right.position);
  return typeof options.limit === "number" ? items.slice(0, Math.max(0, options.limit)) : items;
}

export interface CtrGapItem {
  query: string;
  pageUrl: string;
  position: number;
  ctr: number;
  expectedCtr: number;
  ctrGap: number;
  missedClicks: number;
  impressions: number;
}

export interface CtrGapOptions {
  maxPosition?: number;
  minGap?: number;
  limit?: number;
}

// CTR-Gap: Seiten in den Top-N (Default Position ≤ 10), deren CTR unter dem Positions-Benchmark
// liegt. missedClicks = entgangene Klicks bei Benchmark-CTR, nach Wirkung sortiert.
export function analyzeCtrGap(rows: SearchPerformanceMetricRow[], options: CtrGapOptions = {}): CtrGapItem[] {
  const maxPosition = options.maxPosition ?? 10;
  const minGap = options.minGap ?? 0.01;
  const items = rows
    .filter((row) => row.position <= maxPosition)
    .map((row) => {
      const expectedCtr = expectedCtrForPosition(row.position);
      const ctrGap = Number((expectedCtr - row.ctr).toFixed(4));
      const missedClicks = Math.max(0, Math.round(row.impressions * ctrGap));
      return { query: row.query, pageUrl: row.pageUrl, position: row.position, ctr: row.ctr, expectedCtr, ctrGap, missedClicks, impressions: row.impressions };
    })
    .filter((item) => item.ctrGap >= minGap && item.missedClicks > 0)
    .sort((left, right) => right.missedClicks - left.missedClicks);
  return typeof options.limit === "number" ? items.slice(0, Math.max(0, options.limit)) : items;
}

export interface CannibalizationPage {
  pageUrl: string;
  position: number;
  clicks: number;
  impressions: number;
}

export interface CannibalizationItem {
  query: string;
  pages: CannibalizationPage[];
  totalImpressions: number;
}

export interface CannibalizationOptions {
  minPages?: number;
  limit?: number;
}

// Kannibalisierung: dieselbe Query rankt mit mehreren eigenen Seiten (Default ≥ 2), die um
// dieselbe Intention konkurrieren. Sortiert nach Gesamt-Impressionen.
export function analyzeCannibalization(rows: SearchPerformanceMetricRow[], options: CannibalizationOptions = {}): CannibalizationItem[] {
  const minPages = options.minPages ?? 2;
  const byQuery = new Map<string, Map<string, CannibalizationPage>>();
  for (const row of rows) {
    let pages = byQuery.get(row.query);
    if (!pages) {
      pages = new Map<string, CannibalizationPage>();
      byQuery.set(row.query, pages);
    }
    const existing = pages.get(row.pageUrl);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.position = Math.min(existing.position, row.position);
    } else {
      pages.set(row.pageUrl, { pageUrl: row.pageUrl, position: row.position, clicks: row.clicks, impressions: row.impressions });
    }
  }

  const items: CannibalizationItem[] = [];
  for (const [query, pages] of byQuery) {
    if (pages.size < minPages) continue;
    const pageList = [...pages.values()].sort((left, right) => left.position - right.position);
    const totalImpressions = pageList.reduce((sum, page) => sum + page.impressions, 0);
    items.push({ query, pages: pageList, totalImpressions });
  }
  items.sort((left, right) => right.totalImpressions - left.totalImpressions);
  return typeof options.limit === "number" ? items.slice(0, Math.max(0, options.limit)) : items;
}
