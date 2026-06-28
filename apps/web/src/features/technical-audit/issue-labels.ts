/**
 * issue-labels — server-safe (no "use client") rule label map for Technical Audit.
 *
 * `ruleLabel` is consumed by BOTH a server component (IssueFilterBar) and a
 * client component (IssueGroups). It must therefore live in a plain module with
 * no "use client" directive — calling a function exported from a client module
 * during server render throws an RSC boundary error.
 */
import type { IssueGroup } from "../../lib/audit-api";

const RULE_LABEL: Record<IssueGroup["rule"], string> = {
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
