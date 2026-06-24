/**
 * board-logic.ts — pure, API-free helpers for the Opportunity Board (UX-5).
 *
 * Deliberately imports NO api-client/server module, so the client islands
 * (PriorityMatrix, Kanban, FilterBar table, Evidence-Chain-Drawer) can import
 * these helpers WITHOUT pulling the Node-only internal API (node:fs/crypto)
 * into the browser bundle. The server loader lives in board-api.ts and
 * re-exports everything here for back-compat.
 *
 * All client-side filtering (type / status / impact / effort) happens here —
 * there is NO new backend (per spec §G, Teil 3).
 */

import type { ConfidenceLevel } from "../components/confidence-badge";
import type { Opportunity, OpportunityStatus } from "@seo-tool/domain-model";

// ---------------------------------------------------------------------------
// Opportunity type metadata (tokens from chart-theme categorical scale)
// ---------------------------------------------------------------------------

export type OpportunityType = Opportunity["type"];

export const OPPORTUNITY_TYPES: OpportunityType[] = [
  "technical_fix",
  "low_hanging_keyword",
  "cannibalization",
  "money_page",
  "internal_link_gap",
  "aeo",
];

export const BOARD_STATUSES: OpportunityStatus[] = [
  "open",
  "planned",
  "in_progress",
  "implemented",
  "validated",
  "reopened",
  "dismissed",
  "expired",
];

/** Human-readable German label for an opportunity type. */
export function opportunityTypeLabel(type: OpportunityType): string {
  switch (type) {
    case "technical_fix":       return "Technischer Fix";
    case "low_hanging_keyword": return "Keyword-Chance";
    case "cannibalization":     return "Kannibalisierung";
    case "money_page":          return "Money-Page";
    case "internal_link_gap":   return "Interne Verlinkung";
    case "aeo":                 return "AEO";
    default:                    return type;
  }
}

/**
 * Map an opportunity type to its categorical chart-theme key.
 * (chartTheme.categorical keys: technical, keyword, cannibal, money, link, aeo)
 */
export function opportunityTypeColorKey(
  type: OpportunityType
): "technical" | "keyword" | "cannibal" | "money" | "link" | "aeo" {
  switch (type) {
    case "technical_fix":       return "technical";
    case "low_hanging_keyword": return "keyword";
    case "cannibalization":     return "cannibal";
    case "money_page":          return "money";
    case "internal_link_gap":   return "link";
    case "aeo":                 return "aeo";
    default:                    return "technical";
  }
}

// ---------------------------------------------------------------------------
// confidence (0–1 float) → A–E level (mirrors dashboard.tsx)
// ---------------------------------------------------------------------------

export function confidenceToLevel(conf: number): ConfidenceLevel {
  if (!Number.isFinite(conf)) return "E";
  if (conf >= 0.9) return "A";
  if (conf >= 0.7) return "B";
  if (conf >= 0.5) return "C";
  if (conf >= 0.3) return "D";
  return "E";
}

// ---------------------------------------------------------------------------
// Kanban columns: status → board column
// ---------------------------------------------------------------------------

export type KanbanColumn = "open" | "in_progress" | "implemented" | "validated";

export interface KanbanColumnDef {
  key: KanbanColumn;
  label: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { key: "open",        label: "Offen" },
  { key: "in_progress", label: "In Arbeit" },
  { key: "implemented", label: "Umgesetzt" },
  { key: "validated",   label: "Validiert" },
];

/**
 * Map a granular OpportunityStatus to one of the four Kanban columns.
 * Returns null for statuses that are not shown on the board (dismissed/expired).
 */
export function statusToColumn(status: OpportunityStatus): KanbanColumn | null {
  switch (status) {
    case "open":
    case "planned":
    case "reopened":
      return "open";
    case "in_progress":
      return "in_progress";
    case "implemented":
      return "implemented";
    case "validated":
      return "validated";
    case "dismissed":
    case "expired":
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Client-side filter predicate (0-backend)
// ---------------------------------------------------------------------------

export interface BoardFilter {
  type?: OpportunityType | "all";
  status?: OpportunityStatus | "all";
  /** Minimum expectedImpact (1–5). undefined / 0 = no floor. */
  minImpact?: number;
  /** Maximum effort (1–5). undefined / 0 = no ceiling. */
  maxEffort?: number;
}

/** Pure predicate: does an opportunity pass the active filter? */
export function matchesFilter(opportunity: Opportunity, filter: BoardFilter): boolean {
  if (filter.type && filter.type !== "all" && opportunity.type !== filter.type) {
    return false;
  }
  if (filter.status && filter.status !== "all" && opportunity.status !== filter.status) {
    return false;
  }
  if (filter.minImpact && Number.isFinite(filter.minImpact) && opportunity.expectedImpact < filter.minImpact) {
    return false;
  }
  if (filter.maxEffort && Number.isFinite(filter.maxEffort) && opportunity.effort > filter.maxEffort) {
    return false;
  }
  return true;
}

/** Apply a filter to a list (pure, used by both UI and tests). */
export function filterOpportunities(opportunities: Opportunity[], filter: BoardFilter): Opportunity[] {
  return opportunities.filter((o) => matchesFilter(o, filter));
}
