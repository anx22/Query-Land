/**
 * backlinks-logic.ts — pure, API-free helpers for the Backlinks screen (UX-4 §H).
 *
 * Deliberately imports NO api-client / server module, so client islands
 * (charts, tables) can import these helpers WITHOUT dragging the Node-only
 * internal API (node:fs/crypto) into the browser bundle. The server loader
 * lives in `lib/backlinks-api.ts`; client islands receive plain serialisable
 * props only.
 *
 * Everything here is unit-testable without rendering or network access.
 */

import type {
  AuthoritySummary,
  BacklinkDiff,
  BacklinkSnapshot,
  ReferringDomain,
} from "@seo-tool/domain-model";

// ---------------------------------------------------------------------------
// Trend points (serialisable for TrendChart: {label, value}[])
// ---------------------------------------------------------------------------

export interface TrendPoint {
  label: string;
  value: number;
}

/** Format an ISO timestamp to a short de-DE day/month label. Falls back to raw. */
export function shortDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
}

/** Sort snapshots oldest → newest by capturedAt (immutable). */
export function sortSnapshotsAsc(snapshots: BacklinkSnapshot[]): BacklinkSnapshot[] {
  return [...snapshots].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
}

/** Trend of total backlinks over time (oldest → newest). */
export function backlinkTrend(snapshots: BacklinkSnapshot[]): TrendPoint[] {
  return sortSnapshotsAsc(snapshots).map((snap) => ({
    label: shortDateLabel(snap.capturedAt),
    value: snap.totalBacklinks,
  }));
}

/** Trend of referring domains over time (oldest → newest). */
export function referringDomainTrend(snapshots: BacklinkSnapshot[]): TrendPoint[] {
  return sortSnapshotsAsc(snapshots).map((snap) => ({
    label: shortDateLabel(snap.capturedAt),
    value: snap.referringDomains,
  }));
}

// ---------------------------------------------------------------------------
// New vs. Lost flow (diverging bars) from the latest diff
// ---------------------------------------------------------------------------

export interface FlowBar {
  /** Category label (e.g. "Backlinks"). */
  label: string;
  /** Count gained (rendered upward / positive). */
  gained: number;
  /** Count lost (rendered downward / negative). */
  lost: number;
}

/**
 * Map a BacklinkDiff to two diverging-bar categories: Backlinks and Domains.
 * `gained`/`lost` are non-negative counts; the chart renders `lost` downward.
 * Returns an empty array when there is no diff (fewer than two snapshots).
 */
export function diffToFlowBars(diff: BacklinkDiff | null): FlowBar[] {
  if (!diff) return [];
  return [
    { label: "Backlinks", gained: diff.newBacklinks.length, lost: diff.lostBacklinks.length },
    { label: "Verweisende Domains", gained: diff.newReferringDomains.length, lost: diff.lostReferringDomains.length },
  ];
}

// ---------------------------------------------------------------------------
// Follow / Nofollow distribution
// ---------------------------------------------------------------------------

export interface FollowSplit {
  followCount: number;
  nofollowCount: number;
  followRatio: number;
  followPct: number;
  nofollowPct: number;
}

/**
 * Split total backlinks into follow / nofollow using the authority follow-ratio.
 * followRatio is a 0–1 fraction. Returns zeroes for missing/empty authority.
 */
export function followSplit(authority: AuthoritySummary | null): FollowSplit {
  if (!authority || authority.totalBacklinks <= 0) {
    return { followCount: 0, nofollowCount: 0, followRatio: 0, followPct: 0, nofollowPct: 0 };
  }
  const total = authority.totalBacklinks;
  const ratio = clamp01(authority.followRatio);
  const followCount = Math.round(total * ratio);
  const nofollowCount = total - followCount;
  return {
    followCount,
    nofollowCount,
    followRatio: ratio,
    followPct: round1(ratio * 100),
    nofollowPct: round1((1 - ratio) * 100),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Formatters (de-DE)
// ---------------------------------------------------------------------------

/** Format an integer with de-DE grouping; "—" for nullish/NaN. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE");
}

/** Format a 0–1 ratio as a percentage string (one decimal). "—" when null. */
export function formatRatioPct(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${round1(clamp01(ratio) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

/** Format a 0–1 share as a percentage string (one decimal). "—" when null. */
export function formatSharePct(share: number | null | undefined): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return "—";
  return `${round1(share * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

// ---------------------------------------------------------------------------
// Snapshot delta (latest vs. previous) for DeltaChips
// ---------------------------------------------------------------------------

export interface SnapshotDeltas {
  /** Latest snapshot (or null). */
  latest: BacklinkSnapshot | null;
  /** Previous snapshot (or null when fewer than two). */
  previous: BacklinkSnapshot | null;
  /** Change in total backlinks vs. previous (null when no previous). */
  backlinkDelta: number | null;
  /** Change in referring domains vs. previous (null when no previous). */
  domainDelta: number | null;
}

export function snapshotDeltas(snapshots: BacklinkSnapshot[]): SnapshotDeltas {
  const sorted = sortSnapshotsAsc(snapshots);
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  return {
    latest,
    previous,
    backlinkDelta: latest && previous ? latest.totalBacklinks - previous.totalBacklinks : null,
    domainDelta: latest && previous ? latest.referringDomains - previous.referringDomains : null,
  };
}

// ---------------------------------------------------------------------------
// Referring-domain row sorting (for the table)
// ---------------------------------------------------------------------------

/** Sort referring domains by backlink count desc, then domain asc (immutable). */
export function sortReferringDomains(domains: ReferringDomain[]): ReferringDomain[] {
  return [...domains].sort(
    (left, right) => right.backlinks - left.backlinks || left.domain.localeCompare(right.domain)
  );
}
