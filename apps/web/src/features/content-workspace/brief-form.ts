/**
 * brief-form.ts — pure, framework-free helpers for the Content-Workspace brief
 * editor (UX7-W2). No React / no "use client" so they are unit-testable in
 * isolation. Two concerns:
 *
 *   1. Parsing/serialising the brief's list-shaped fields (target queries,
 *      sections, terms, internal links) between the editable textarea/checklist
 *      representation and the API's first-class arrays.
 *   2. Validating a brief before it is sent to the API, and resolving the
 *      action-feedback banner + the active status filter from search params.
 *
 * Mirrors the technical-audit action-banner / url-explorer helper style.
 */

import type {
  ContentIntent,
  ContentInternalLink,
  ContentRecommendationStatus,
  ContentTerm,
} from "@seo-tool/domain-model";
import { CONTENT_INTENTS, CONTENT_RECOMMENDATION_STATUSES } from "@seo-tool/domain-model";

// ---------------------------------------------------------------------------
// Status filter (server-side ?status=)
// ---------------------------------------------------------------------------

export type BriefStatusFilter = "all" | ContentRecommendationStatus;

export const BRIEF_STATUS_FILTERS: readonly BriefStatusFilter[] = [
  "all",
  ...CONTENT_RECOMMENDATION_STATUSES,
];

const STATUS_LABELS: Record<ContentRecommendationStatus, string> = {
  draft: "Entwurf",
  ready: "Bereit",
  in_progress: "In Arbeit",
  done: "Erledigt",
  dismissed: "Verworfen",
};

/** German label for a status (or "Alle" for the all-filter). */
export function briefStatusLabel(status: BriefStatusFilter): string {
  return status === "all" ? "Alle" : STATUS_LABELS[status];
}

/** Normalise raw query input into a valid status filter, defaulting to "all". */
export function resolveBriefStatusFilter(raw: string | undefined): BriefStatusFilter {
  return BRIEF_STATUS_FILTERS.includes(raw as BriefStatusFilter) ? (raw as BriefStatusFilter) : "all";
}

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

/**
 * The status transitions offered for a brief in its current state. Mirrors the
 * backend lifecycle: draft → ready → in_progress → done, dismissible from any
 * non-terminal state, and reopenable from done/dismissed back to draft.
 * Pure so the available buttons can be unit-tested.
 */
export function availableTransitions(
  status: ContentRecommendationStatus
): ContentRecommendationStatus[] {
  switch (status) {
    case "draft":
      return ["ready", "dismissed"];
    case "ready":
      return ["in_progress", "dismissed"];
    case "in_progress":
      return ["done", "dismissed"];
    case "done":
      return ["draft"];
    case "dismissed":
      return ["draft"];
    default:
      return [];
  }
}

/** True when the brief is in a terminal state where editing is rejected by the API. */
export function isBriefEditable(status: ContentRecommendationStatus): boolean {
  return status !== "done" && status !== "dismissed";
}

// ---------------------------------------------------------------------------
// List-field parsing / serialisation
// ---------------------------------------------------------------------------

/** Split a textarea value into trimmed, non-empty lines (one entry per line). */
export function parseLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Render a string list back into a newline-joined textarea value. */
export function serializeLines(values: string[]): string {
  return values.join("\n");
}

/**
 * Parse the manual term checklist. Input is one term per line; a leading
 * "[x]" / "[X]" marks the term as done (so the checklist round-trips through a
 * textarea). Duplicate terms (case-insensitive) collapse to the first.
 */
export function parseTerms(raw: string | null | undefined): ContentTerm[] {
  const seen = new Set<string>();
  const terms: ContentTerm[] = [];
  for (const line of parseLines(raw)) {
    const match = line.match(/^\[\s*([xX ])?\s*\]\s*(.+)$/);
    const done = match ? match[1]?.toLowerCase() === "x" : false;
    const term = (match ? match[2] : line).trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push({ term, done });
  }
  return terms;
}

/** Serialise the term checklist back to the "[x] term" textarea form. */
export function serializeTerms(terms: ContentTerm[]): string {
  return terms.map((t) => `[${t.done ? "x" : " "}] ${t.term}`).join("\n");
}

/**
 * Parse internal links from a textarea. One link per line, fields separated by
 * "|": url | anchor | reason. Only url is required; anchor/reason are optional.
 */
export function parseInternalLinks(raw: string | null | undefined): ContentInternalLink[] {
  const links: ContentInternalLink[] = [];
  for (const line of parseLines(raw)) {
    const [urlPart, anchorPart, reasonPart] = line.split("|").map((p) => p.trim());
    if (!urlPart) continue;
    links.push({
      url: urlPart,
      anchor: anchorPart && anchorPart.length > 0 ? anchorPart : null,
      reason: reasonPart && reasonPart.length > 0 ? reasonPart : "manuell hinzugefügt",
    });
  }
  return links;
}

/** Serialise internal links back to the "url | anchor | reason" textarea form. */
export function serializeInternalLinks(links: ContentInternalLink[]): string {
  return links
    .map((l) => [l.url, l.anchor ?? "", l.reason ?? ""].join(" | "))
    .join("\n");
}

/**
 * Append a suggested internal link to an existing list, de-duplicating by url.
 * Returns the same array reference's content as a new array (pure).
 */
export function addInternalLink(
  existing: ContentInternalLink[],
  link: ContentInternalLink
): ContentInternalLink[] {
  if (existing.some((l) => l.url === link.url)) return [...existing];
  return [...existing, link];
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

const INTENT_LABELS: Record<ContentIntent, string> = {
  informational: "Informativ",
  commercial: "Kommerziell",
  transactional: "Transaktional",
  navigational: "Navigational",
};

export function intentLabel(intent: ContentIntent): string {
  return INTENT_LABELS[intent];
}

/** Coerce an arbitrary string into a valid intent, defaulting to informational. */
export function resolveIntent(raw: string | null | undefined): ContentIntent {
  return CONTENT_INTENTS.includes(raw as ContentIntent) ? (raw as ContentIntent) : "informational";
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface BriefDraft {
  url: string;
  title: string;
  targetTopic: string;
  intent: ContentIntent;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate the required brief fields before a create/update is sent to the API.
 * url + title are required; intent must be one of the known values. Returns all
 * problems at once (German messages) so the form can surface them together.
 */
export function validateBriefDraft(draft: BriefDraft): ValidationResult {
  const errors: string[] = [];
  if (!draft.url || draft.url.trim() === "") {
    errors.push("URL ist erforderlich.");
  }
  if (!draft.title || draft.title.trim() === "") {
    errors.push("Titel ist erforderlich.");
  }
  if (!CONTENT_INTENTS.includes(draft.intent)) {
    errors.push("Such-Intent ist ungültig.");
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Action banner (mirrors technical-audit/action-banner)
// ---------------------------------------------------------------------------

export type WorkspaceBannerTone = "success" | "danger";

export interface WorkspaceBanner {
  tone: WorkspaceBannerTone;
  message: string;
  role: "alert" | "status";
}

const SAVED_MESSAGES: Record<string, string> = {
  created: "Brief erstellt.",
  updated: "Brief gespeichert.",
  transitioned: "Status des Briefs aktualisiert.",
  proposal: "Vorschlag (Ticket/PR) aus dem Brief erstellt.",
  linked: "Interner Link zum Brief hinzugefügt.",
};

/**
 * Resolve the workspace action banner from search params. An error always wins
 * over a success flag. `saved` carries a key into SAVED_MESSAGES.
 */
export function resolveWorkspaceBanner(input: {
  error?: string;
  saved?: string;
} = {}): WorkspaceBanner | null {
  const error = typeof input.error === "string" ? input.error.trim() : "";
  if (error) {
    return { tone: "danger", message: error, role: "alert" };
  }
  const saved = typeof input.saved === "string" ? input.saved.trim() : "";
  if (saved && SAVED_MESSAGES[saved]) {
    return { tone: "success", message: SAVED_MESSAGES[saved], role: "status" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Score gauge band (shared math the page uses to caption the gauge)
// ---------------------------------------------------------------------------

export type ScoreBand = "good" | "warn" | "bad" | "unknown";

/**
 * Classify a 0–100 content score into a functional band, matching the gauge
 * color thresholds (≥70 good, ≥40 warn, else bad). Null → unknown. Pure.
 */
export function scoreBand(score: number | null): ScoreBand {
  if (score === null || !Number.isFinite(score)) return "unknown";
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "bad";
}

const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  good: "gut",
  warn: "verbesserungswürdig",
  bad: "kritisch",
  unknown: "kein Score",
};

export function scoreBandLabel(score: number | null): string {
  return SCORE_BAND_LABELS[scoreBand(score)];
}
