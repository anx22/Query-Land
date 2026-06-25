/**
 * crawl-diff.ts — pure, unit-testable helpers for the Crawl-Vergleich
 * (crawl-diff) section of the Technical Audit overview (UX-6b / D2).
 *
 * No "use client" / no React: everything here is a pure function so it can be
 * tested with vitest and reused by both the server page (run-selector href
 * building) and the diff section rendering (delta formatting + labels).
 */

import type { AuditIssueSeverity, CrawlRun, CrawlRunDiffIssue } from "@seo-tool/domain-model";

// ---------------------------------------------------------------------------
// Delta formatting (sign + tone, null-safe)
// ---------------------------------------------------------------------------

/** Functional tone of a delta value (paired with text + sign, never color-only). */
export type DeltaTone = "positive" | "negative" | "neutral";

export interface FormattedDelta {
  /** Signed, locale-formatted value, e.g. "+3", "−2", "0", or "—" when unknown. */
  text: string;
  /** Functional tone for styling (good/bad/neutral), "neutral" when unknown. */
  tone: DeltaTone;
}

/**
 * Format a numeric delta into a signed string + functional tone.
 *
 * `higherIsBetter` controls how the sign maps onto the tone:
 *   - Health-Score: a rise (+) is good      → higherIsBetter = true
 *   - Open issues:  a rise (+) is bad        → higherIsBetter = false
 *   - Discovered URLs: neither good nor bad   → "neutral" tone via direction = "none"
 *
 * Null values (e.g. healthScore when either run lacks a score) render as "—"
 * with a neutral tone.
 */
export function formatDelta(
  value: number | null | undefined,
  direction: "higherIsBetter" | "higherIsWorse" | "none" = "none"
): FormattedDelta {
  if (value == null || !Number.isFinite(value)) {
    return { text: "—", tone: "neutral" };
  }

  const rounded = Math.round(value * 100) / 100;
  const text = formatSigned(rounded);

  if (rounded === 0 || direction === "none") {
    return { text, tone: "neutral" };
  }

  const isRise = rounded > 0;
  const good = direction === "higherIsBetter" ? isRise : !isRise;
  return { text, tone: good ? "positive" : "negative" };
}

/** Signed locale string: "+3", "−2" (real minus sign), "0". */
export function formatSigned(value: number): string {
  if (value > 0) return `+${value.toLocaleString("de-DE")}`;
  if (value < 0) return `−${Math.abs(value).toLocaleString("de-DE")}`;
  return "0";
}

// ---------------------------------------------------------------------------
// Labels (rule + severity) — pure, shared by the server-rendered diff lists
// ---------------------------------------------------------------------------

const SEVERITY_LABEL: Record<AuditIssueSeverity, string> = {
  critical: "Kritisch",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

const SEVERITY_BADGE: Record<AuditIssueSeverity, string> = {
  critical: "danger",
  high: "warning",
  medium: "primary",
  low: "",
};

const RULE_LABEL: Record<CrawlRunDiffIssue["rule"], string> = {
  http_error: "HTTP-Fehler",
  redirect_chain: "Redirect-Kette",
  missing_title: "Fehlender Title",
  duplicate_title: "Doppelter Title",
  canonical_mismatch: "Canonical-Abweichung",
  broken_link: "Defekter Link",
};

/** Human-readable label for an audit-issue severity (German). */
export function severityLabel(severity: AuditIssueSeverity): string {
  return SEVERITY_LABEL[severity] ?? severity;
}

/** Functional badge tone for a severity (paired with text). */
export function severityBadgeTone(severity: AuditIssueSeverity): string {
  return SEVERITY_BADGE[severity] ?? "";
}

/** Human-readable label for an audit-issue rule (German). */
export function diffRuleLabel(rule: CrawlRunDiffIssue["rule"]): string {
  return RULE_LABEL[rule] ?? rule;
}

// ---------------------------------------------------------------------------
// Run selection (server-rendered selectors via searchParams)
// ---------------------------------------------------------------------------

/** Normalized crawl-diff selection from the raw query params. */
export interface DiffSelection {
  base: string | null;
  compare: string | null;
}

/**
 * Resolve the requested diff selection against the available run ids. Unknown
 * ids (no longer in the run list) are dropped so a stale link never triggers a
 * doomed fetch. A run can never be diffed against itself (compare cleared when
 * it equals base).
 */
export function resolveDiffSelection(
  raw: { diffBase?: string; diffCompare?: string },
  availableRunIds: string[]
): DiffSelection {
  const known = new Set(availableRunIds);
  const base = raw.diffBase && known.has(raw.diffBase) ? raw.diffBase : null;
  let compare = raw.diffCompare && known.has(raw.diffCompare) ? raw.diffCompare : null;
  if (compare && compare === base) compare = null;
  return { base, compare };
}

/** True when both sides of the selection are present (→ fetch + render the diff). */
export function hasCompleteSelection(selection: DiffSelection): boolean {
  return selection.base !== null && selection.compare !== null;
}

/**
 * Build a /technical-audit href that preserves existing query params but
 * overrides a single diff selector param (omitting it when empty). Mirrors the
 * paginationHref pattern (defaults omitted from the URL).
 */
export function diffSelectionHref(
  current: Record<string, string | undefined>,
  param: "diffBase" | "diffCompare",
  value: string | null
): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(current)) {
    if (key === param) continue;
    if (val != null && val !== "") params.set(key, val);
  }
  if (value) params.set(param, value);
  const qs = params.toString();
  return qs ? `/technical-audit?${qs}` : "/technical-audit";
}

/** Short, human label for a crawl run in a selector (date + trigger). */
export function runOptionLabel(run: Pick<CrawlRun, "startedAt" | "trigger">): string {
  const when = formatTimestamp(run.startedAt);
  return `${when} · ${run.trigger}`;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE");
}
