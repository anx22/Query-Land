"use client";

/**
 * IssueGroups — collapsible audit-issue groups for the Technical Audit overview
 * (UX-6, spec §5.3 / §5.4-style overview). Replaces a flat issue table.
 *
 * Each group = rule + severity, with an impact score (count × severity weight),
 * a severity badge, and a collapsible list of sample issues. Factual copy only.
 *
 * Serious-Zone: no metaphor; severity colors are functional and paired with text.
 * A11y: native <details>/<summary> (keyboard + screen-reader friendly).
 * Empty-state handled by the parent (renders nothing when there are no groups).
 */

import type { AuditIssueSeverity } from "@seo-tool/domain-model";
import type { IssueGroup } from "../../lib/audit-api";

const SEVERITY_BADGE: Record<AuditIssueSeverity, string> = {
  critical: "danger",
  high: "warning",
  medium: "primary",
  low: "",
};

const SEVERITY_LABEL: Record<AuditIssueSeverity, string> = {
  critical: "Kritisch",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

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

export interface IssueGroupsProps {
  groups: IssueGroup[];
}

export function IssueGroups({ groups }: IssueGroupsProps) {
  if (groups.length === 0) {
    return (
      <p className="audit-issues-empty">
        Keine offenen Issues. Sobald ein Crawl Probleme findet, werden sie hier nach Regel und
        Schweregrad gruppiert.
      </p>
    );
  }

  return (
    <div className="audit-issue-groups">
      {groups.map((group, index) => (
        <details className="audit-issue-group" key={group.key} open={index === 0}>
          <summary className="audit-issue-group__summary">
            <span className={`badge ${SEVERITY_BADGE[group.severity]}`.trim()}>
              {SEVERITY_LABEL[group.severity]}
            </span>
            <span className="audit-issue-group__rule">{ruleLabel(group.rule)}</span>
            <span className="audit-issue-group__count">
              {group.count.toLocaleString("de-DE")} {group.count === 1 ? "Issue" : "Issues"}
            </span>
            <span className="audit-issue-group__impact" title="Impact = Anzahl × Schweregrad-Gewicht">
              Impact {group.impact.toLocaleString("de-DE")}
            </span>
          </summary>
          <ul className="audit-issue-group__list">
            {group.issues.map((issue) => (
              <li className="audit-issue-group__item" key={issue.id}>
                <span className="audit-issue-group__url">{issue.url}</span>
                <span className="audit-issue-group__message">{issue.message}</span>
              </li>
            ))}
            {group.count > group.issues.length ? (
              <li className="audit-issue-group__more">
                + {(group.count - group.issues.length).toLocaleString("de-DE")} weitere
              </li>
            ) : null}
          </ul>
        </details>
      ))}
    </div>
  );
}
