// Pure helpers for issue lifecycle actions — shared by the detail drawer and
// unit tests (kept free of "use client"/JSX so it imports cleanly anywhere).

import type { AuditIssueHistoryEntry } from "@seo-tool/domain-model";

export type IssueAction = "resolve" | "dismiss" | "reopen";

export const ISSUE_ACTION_LABEL: Record<IssueAction, string> = {
  resolve: "Als gelöst markieren",
  dismiss: "Verwerfen",
  reopen: "Wieder öffnen",
};

/** Minimal lifecycle view of an issue (resolved vs. dismissed are distinct). */
export interface IssueLifecycle {
  resolvedAt: string | null;
  dismissedAt?: string | null;
}

/** Open issues can be resolved or dismissed; closed (resolved/dismissed) issues can be reopened. */
export function availableIssueActions(issue: IssueLifecycle): IssueAction[] {
  return isIssueOpen(issue) ? ["resolve", "dismiss"] : ["reopen"];
}

/** True when the issue is neither resolved nor dismissed. */
export function isIssueOpen(issue: IssueLifecycle): boolean {
  return issue.resolvedAt === null && (issue.dismissedAt ?? null) === null;
}

export function issueStatusLabel(issue: IssueLifecycle): string {
  if ((issue.dismissedAt ?? null) !== null) return "Verworfen";
  return issue.resolvedAt === null ? "Offen" : "Gelöst";
}

const HISTORY_ACTION_LABEL: Record<AuditIssueHistoryEntry["action"], string> = {
  resolve: "Gelöst",
  dismiss: "Verworfen",
  reopen: "Wieder geöffnet",
};

/** German label for a history transition action. */
export function historyActionLabel(action: AuditIssueHistoryEntry["action"]): string {
  return HISTORY_ACTION_LABEL[action] ?? action;
}

/** One formatted lifecycle history line: "Verworfen · system · 25.06.2026, … · Grund". */
export function formatHistoryEntry(entry: AuditIssueHistoryEntry): string {
  const when = new Date(entry.createdAt).toLocaleString("de-DE");
  const base = `${historyActionLabel(entry.action)} · ${entry.actor} · ${when}`;
  return entry.reason ? `${base} · ${entry.reason}` : base;
}
