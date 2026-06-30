/**
 * Shared, framework-agnostic labels for audit-issue rules.
 *
 * Kept in a plain (non-"use client") module so both the client `IssueGroups`
 * component and the server-rendered `IssueFilterBar` can import `ruleLabel`
 * without crossing the server/client boundary. Importing a function from a
 * "use client" module into a server component and calling it throws
 * ("Attempted to call ruleLabel() from the server …").
 */
import type { IssueGroup } from "../../lib/audit-api";

export const RULE_LABEL: Record<IssueGroup["rule"], string> = {
  http_error: "HTTP-Fehler",
  redirect_chain: "Redirect-Kette",
  missing_title: "Fehlender Title",
  duplicate_title: "Doppelter Title",
  canonical_mismatch: "Canonical-Abweichung",
  broken_link: "Defekter Link",
};

export function ruleLabel(rule: IssueGroup["rule"]): string {
  return RULE_LABEL[rule] ?? rule;
}
