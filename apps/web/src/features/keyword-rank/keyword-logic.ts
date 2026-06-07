/**
 * keyword-logic.ts — pure, API-free helpers for the Keywords & Rankings screen
 * (UX, Teil 3 §F).
 *
 * Deliberately imports NO api-client/server module, so the client islands
 * (KeywordTable / FilterBar / Inspector) can import these helpers WITHOUT
 * pulling the Node-only internal API (node:fs/crypto) into the browser bundle.
 * The server loader lives in lib/keywords-api.ts and imports from here.
 * (Same pattern as lib/board-logic.ts.)
 *
 * All client-side filtering (Intent / Brand / Markt) happens here — there is
 * NO new backend (per spec §F, Teil 3).
 */

import type {
  Keyword,
  KeywordIntent,
  RankSnapshot,
  SerpDiff,
  SerpSnapshot,
  SourceConfidence,
} from "@seo-tool/domain-model";
import type { ConfidenceLevel } from "../../components/confidence-badge";

// ---------------------------------------------------------------------------
// Position buckets (mirrors lib/overview-api.ts so both screens agree)
// ---------------------------------------------------------------------------

export interface PositionBuckets {
  top3: number;
  top10: number;
  strikingDist: number;
  mid: number;
  weak: number;
  total: number;
}

export function emptyBuckets(): PositionBuckets {
  return { top3: 0, top10: 0, strikingDist: 0, mid: 0, weak: 0, total: 0 };
}

export function positionToBucket(
  position: number
): keyof Omit<PositionBuckets, "total"> | null {
  if (!Number.isFinite(position) || position < 1) return null;
  if (position <= 3) return "top3";
  if (position <= 10) return "top10";
  if (position <= 20) return "strikingDist";
  if (position <= 50) return "mid";
  if (position <= 100) return "weak";
  return null;
}

// ---------------------------------------------------------------------------
// Intent metadata + filter options
// ---------------------------------------------------------------------------

export const KEYWORD_INTENT_OPTIONS: KeywordIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
  "local",
  "comparison",
  "problem_solving",
];

/** Human-readable German label for a keyword intent. */
export function intentLabel(intent: KeywordIntent): string {
  switch (intent) {
    case "informational":
      return "Informativ";
    case "commercial":
      return "Kommerziell";
    case "transactional":
      return "Transaktional";
    case "navigational":
      return "Navigational";
    case "local":
      return "Lokal";
    case "comparison":
      return "Vergleich";
    case "problem_solving":
      return "Problemlösung";
    default:
      return intent;
  }
}

// ---------------------------------------------------------------------------
// SourceConfidence (already A–E) → ConfidenceLevel, defensive
// ---------------------------------------------------------------------------

export function confidenceLevel(value: SourceConfidence | string): ConfidenceLevel {
  const upper = String(value).toUpperCase();
  if (upper === "A" || upper === "B" || upper === "C" || upper === "D" || upper === "E") {
    return upper;
  }
  return "E";
}

// ---------------------------------------------------------------------------
// Rank history → row model (serialisable for client islands)
// ---------------------------------------------------------------------------

export interface RankPoint {
  /** ISO timestamp the snapshot was captured. */
  capturedAt: string;
  /** Position (1-based) or null if unranked. */
  position: number | null;
}

export interface KeywordRow {
  id: string;
  phrase: string;
  intent: KeywordIntent;
  brand: boolean;
  market: string;
  funnelStage: Keyword["funnelStage"];
  targetUrl: string | null;
  sourceConfidence: SourceConfidence;
  groupId: string | null;

  /** Oldest → newest rank history (for the Sparkline). */
  rankHistory: RankPoint[];
  /** Current (latest) position or null. */
  currentPosition: number | null;
  /** Previous position or null (for the DeltaChip). */
  previousPosition: number | null;
  /**
   * Delta = current − previous (raw position change). Lower position is better,
   * so render the DeltaChip with invertColors. null when not computable.
   */
  positionDelta: number | null;
  /** Latest SERP features observed for this keyword (chips). */
  serpFeatures: string[];
}

/**
 * Build a serialisable table row from a keyword + its rank-snapshot history.
 * Snapshots are sorted oldest → newest by capturedAt (defensive copy).
 */
export function buildKeywordRow(
  keyword: Keyword,
  snapshots: RankSnapshot[]
): KeywordRow {
  const sorted = [...(Array.isArray(snapshots) ? snapshots : [])].sort((a, b) =>
    a.capturedAt.localeCompare(b.capturedAt)
  );

  const rankHistory: RankPoint[] = sorted.map((s) => ({
    capturedAt: s.capturedAt,
    position: typeof s.position === "number" ? s.position : null,
  }));

  // Use only ranked points for current/previous/delta.
  const ranked = rankHistory.filter(
    (p): p is RankPoint & { position: number } => p.position != null
  );
  const currentPosition = ranked.length > 0 ? ranked[ranked.length - 1].position : null;
  const previousPosition = ranked.length >= 2 ? ranked[ranked.length - 2].position : null;
  const positionDelta =
    currentPosition != null && previousPosition != null
      ? currentPosition - previousPosition
      : null;

  return {
    id: keyword.id,
    phrase: keyword.phrase,
    intent: keyword.intent,
    brand: keyword.brand,
    market: keyword.market,
    funnelStage: keyword.funnelStage,
    targetUrl: keyword.targetUrl,
    sourceConfidence: keyword.sourceConfidence,
    groupId: keyword.groupId,
    rankHistory,
    currentPosition,
    previousPosition,
    positionDelta,
    serpFeatures: [],
  };
}

/** Per-keyword Inspector payload (rank history + SERP), serialisable for islands. */
export interface KeywordInspectorData {
  keywordId: string;
  rankHistory: RankPoint[];
  serpSnapshots: SerpSnapshot[];
  serpDiff: SerpDiff | null;
}

/**
 * Sparkline series for a row: ranked positions only, oldest → newest, mapped so
 * that a *better* position renders *higher* on the sparkline (Recharts plots
 * larger values higher). We invert with (101 − position) so that position 1
 * peaks and 100 sits near the floor. Empty when there is no ranked history.
 */
export function sparklineSeries(row: KeywordRow): number[] {
  return row.rankHistory
    .filter((p): p is RankPoint & { position: number } => p.position != null)
    .map((p) => 101 - Math.min(100, Math.max(1, p.position)));
}

// ---------------------------------------------------------------------------
// Client-side filter predicate (0-backend)
// ---------------------------------------------------------------------------

export type BrandFilter = "all" | "brand" | "nonbrand";

export interface KeywordFilter {
  intent?: KeywordIntent | "all";
  brand?: BrandFilter;
  /** Market code (e.g. "de-DE"); "all" or undefined = no filter. */
  market?: string | "all";
}

/** Pure predicate: does a row pass the active filter? */
export function matchesKeywordFilter(row: KeywordRow, filter: KeywordFilter): boolean {
  if (filter.intent && filter.intent !== "all" && row.intent !== filter.intent) {
    return false;
  }
  if (filter.brand && filter.brand !== "all") {
    if (filter.brand === "brand" && !row.brand) return false;
    if (filter.brand === "nonbrand" && row.brand) return false;
  }
  if (filter.market && filter.market !== "all" && row.market !== filter.market) {
    return false;
  }
  return true;
}

/** Apply a filter to a list (pure, used by both UI and tests). */
export function filterKeywordRows(rows: KeywordRow[], filter: KeywordFilter): KeywordRow[] {
  return rows.filter((row) => matchesKeywordFilter(row, filter));
}

/** Distinct, sorted market codes present in the rows (for the FilterBar). */
export function distinctMarkets(rows: KeywordRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.market) seen.add(row.market);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Aggregate the rows' current positions into PositionBuckets. */
export function bucketsFromRows(rows: KeywordRow[]): PositionBuckets {
  const buckets = emptyBuckets();
  for (const row of rows) {
    if (row.currentPosition == null) continue;
    const bucket = positionToBucket(row.currentPosition);
    if (bucket) {
      buckets[bucket]++;
      buckets.total++;
    }
  }
  return buckets;
}
