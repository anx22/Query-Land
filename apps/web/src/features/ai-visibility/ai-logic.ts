/**
 * ai-logic.ts — pure, API-free helpers for the AI Visibility feature (spec
 * §4.12). Imports NO api-client/server module, so the client islands
 * (citation matrix, proposals list) can use these helpers WITHOUT pulling the
 * Node-only internal API (node:fs/crypto) into the browser bundle.
 *
 * The server loader lives in lib/ai-visibility-api.ts and passes plain
 * serializable props to the islands.
 *
 * Serious-zone reminder: citation data is Class E — a signal, never evidence.
 * All copy here is factual; no metaphor, no overclaiming.
 */

import type { ProposalKind, ProposalStatus } from "@seo-tool/domain-model";

/** Citation status for a single prompt row in the matrix. */
export type CitationStatus = "cited" | "mentioned" | "absent" | "none";

/** Serializable shape the citation-matrix island consumes (no Date objects). */
export interface CitationMatrixRow {
  promptId: string;
  prompt: string;
  market: string;
  status: CitationStatus;
  /** Domains cited in the latest snapshot (may be empty). */
  citedDomains: string[];
  snapshotCount: number;
  /** ISO timestamp of the latest snapshot, or null. */
  capturedAt: string | null;
}

/**
 * Derive the citation status from the latest snapshot signals.
 *   - cited     → our domain was cited (ourCited)
 *   - mentioned → brand named but not cited (brandMentioned only)
 *   - absent    → a snapshot exists but neither cited nor mentioned
 *   - none      → no snapshot captured yet
 */
export function citationStatus(
  latest: { ourCited: boolean; brandMentioned: boolean } | null,
): CitationStatus {
  if (!latest) return "none";
  if (latest.ourCited) return "cited";
  if (latest.brandMentioned) return "mentioned";
  return "absent";
}

/** Filled ● for cited, hollow ○ otherwise (mentioned uses a half glyph). */
export function citationGlyph(status: CitationStatus): string {
  switch (status) {
    case "cited":
      return "●"; // ●
    case "mentioned":
      return "◐"; // ◐
    case "absent":
      return "○"; // ○
    case "none":
      return "–"; // –
  }
}

/** Factual German label for a citation status. */
export function citationStatusLabel(status: CitationStatus): string {
  switch (status) {
    case "cited":
      return "Zitiert";
    case "mentioned":
      return "Erwähnt (nicht zitiert)";
    case "absent":
      return "Nicht zitiert";
    case "none":
      return "Kein Snapshot";
  }
}

/** Functional badge modifier — paired with text, never color-only. */
export function citationStatusBadge(status: CitationStatus): string {
  switch (status) {
    case "cited":
      return "success";
    case "mentioned":
      return "warning";
    case "absent":
      return "danger";
    case "none":
      return "";
  }
}

/** Human-readable German label for a proposal kind. */
export function proposalKindLabel(kind: ProposalKind): string {
  switch (kind) {
    case "dev_ticket":
      return "Dev-Ticket";
    case "fix_pr":
      return "Fix-PR";
    default:
      return kind;
  }
}

/** Human-readable German label for a proposal status. */
export function proposalStatusLabel(status: ProposalStatus): string {
  switch (status) {
    case "proposed":
      return "Vorgeschlagen";
    case "accepted":
      return "Akzeptiert";
    case "rejected":
      return "Verworfen";
    default:
      return status;
  }
}

/** Functional badge modifier for a proposal status. */
export function proposalStatusBadge(status: ProposalStatus): string {
  switch (status) {
    case "accepted":
      return "success";
    case "rejected":
      return "danger";
    case "proposed":
      return "warning";
    default:
      return "";
  }
}

/** Count how many matrix rows resolve to a "cited" status. */
export function countCited(rows: Array<{ status: CitationStatus }>): number {
  return rows.filter((r) => r.status === "cited").length;
}

/**
 * Minimal serializable inputs needed to build a matrix row. Mirrors the loader's
 * CitationRow but is API-free so the client island can re-derive rows from plain
 * props without importing any Node module.
 */
export interface CitationRowInput {
  promptId: string;
  prompt: string;
  market: string;
  snapshotCount: number;
  latest: {
    ourCited: boolean;
    brandMentioned: boolean;
    citedDomains: string[];
    capturedAt: string;
  } | null;
}

/** Build a serializable CitationMatrixRow from plain inputs (pure). */
export function toMatrixRow(input: CitationRowInput): CitationMatrixRow {
  return {
    promptId: input.promptId,
    prompt: input.prompt,
    market: input.market,
    status: citationStatus(input.latest),
    citedDomains: input.latest?.citedDomains ?? [],
    snapshotCount: input.snapshotCount,
    capturedAt: input.latest?.capturedAt ?? null,
  };
}
