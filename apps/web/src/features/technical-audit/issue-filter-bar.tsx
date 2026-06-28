import {
  ISSUE_RULE_FILTERS,
  ISSUE_SEVERITY_FILTERS,
  ISSUE_STATUS_FILTERS,
  type IssueFilter,
  type IssueRuleFilter,
  type IssueSeverityFilter,
  type IssueStatusFilter,
} from "../../lib/audit-api";
import { ruleLabel } from "./issue-labels";

const STATUS_LABEL: Record<IssueStatusFilter, string> = { open: "Offen", resolved: "Gelöst", all: "Alle" };
const SEVERITY_LABEL: Record<IssueSeverityFilter, string> = {
  all: "Alle",
  critical: "Kritisch",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

/** Label for a rule filter value: "Alle" for the default, else the German rule label. */
function ruleFilterLabel(rule: IssueRuleFilter): string {
  return rule === "all" ? "Alle" : ruleLabel(rule);
}

/** Build the technical-audit URL for a filter (omitting default values). */
export function issueFilterHref(filter: IssueFilter): string {
  const params = new URLSearchParams();
  if (filter.status !== "open") params.set("status", filter.status);
  if (filter.severity !== "all") params.set("severity", filter.severity);
  if (filter.rule !== "all") params.set("issueRule", filter.rule);
  const qs = params.toString();
  return qs ? `/technical-audit?${qs}` : "/technical-audit";
}

export function IssueFilterBar({ active }: { active: IssueFilter }) {
  return (
    <div className="issue-filter-bar">
      <div className="badge-row" role="group" aria-label="Issues nach Status filtern">
        <span className="muted issue-filter-bar__label">Status</span>
        {ISSUE_STATUS_FILTERS.map((status) => {
          const selected = status === active.status;
          return (
            <a
              key={status}
              href={issueFilterHref({ ...active, status })}
              className={selected ? "badge primary" : "badge"}
              aria-current={selected ? "true" : undefined}
            >
              {STATUS_LABEL[status]}
            </a>
          );
        })}
      </div>
      <div className="badge-row" role="group" aria-label="Issues nach Schweregrad filtern">
        <span className="muted issue-filter-bar__label">Schweregrad</span>
        {ISSUE_SEVERITY_FILTERS.map((severity) => {
          const selected = severity === active.severity;
          return (
            <a
              key={severity}
              href={issueFilterHref({ ...active, severity })}
              className={selected ? "badge primary" : "badge"}
              aria-current={selected ? "true" : undefined}
            >
              {SEVERITY_LABEL[severity]}
            </a>
          );
        })}
      </div>
      <div className="badge-row" role="group" aria-label="Issues nach Regel filtern">
        <span className="muted issue-filter-bar__label">Regel</span>
        {ISSUE_RULE_FILTERS.map((rule) => {
          const selected = rule === active.rule;
          return (
            <a
              key={rule}
              href={issueFilterHref({ ...active, rule })}
              className={selected ? "badge primary" : "badge"}
              aria-current={selected ? "true" : undefined}
            >
              {ruleFilterLabel(rule)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
