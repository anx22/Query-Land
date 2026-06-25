// Pure helpers for issue lifecycle actions — shared by the detail drawer and
// unit tests (kept free of "use client"/JSX so it imports cleanly anywhere).

export type IssueAction = "resolve" | "dismiss" | "reopen";

export const ISSUE_ACTION_LABEL: Record<IssueAction, string> = {
  resolve: "Als gelöst markieren",
  dismiss: "Verwerfen",
  reopen: "Wieder öffnen",
};

/** Open issues can be resolved or dismissed; resolved issues can be reopened. */
export function availableIssueActions(issue: { resolvedAt: string | null }): IssueAction[] {
  return issue.resolvedAt === null ? ["resolve", "dismiss"] : ["reopen"];
}

export function issueStatusLabel(issue: { resolvedAt: string | null }): string {
  return issue.resolvedAt === null ? "Offen" : "Gelöst";
}
