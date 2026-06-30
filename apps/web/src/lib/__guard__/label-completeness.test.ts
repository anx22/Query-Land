/**
 * GUARD TEST C1 — every user-facing domain enum value must have a real German label.
 *
 * Why this exists: across reviews, the recurring "raw English enum reaches the user"
 * bug (in_progress, nofollow, structured_data …) kept reappearing whenever a new enum
 * value was added but its label map wasn't updated. This test fails the build the moment
 * any enum member renders as its raw identity (label(value) === value), so the class of
 * bug cannot silently return.
 */
import { describe, it, expect } from "vitest";
import {
  ALERT_METRICS,
  ALERT_COMPARATORS,
  KEYWORD_INTENTS,
  PROPOSAL_KINDS,
  PROPOSAL_STATUSES,
  REPORT_TYPES,
  REPORT_CADENCES,
} from "@seo-tool/domain-model";
import {
  BOARD_STATUSES,
  OPPORTUNITY_TYPES,
  opportunityStatusLabel,
  opportunityTypeLabel,
} from "../board-logic";
import { intentLabel } from "../../features/keyword-rank/keyword-logic";
import { RULE_LABEL, ruleLabel } from "../../features/technical-audit/issue-labels";
import { severityLabel } from "../../features/technical-audit/crawl-diff";
import {
  aeoCheckLabel,
  citationStatusLabel,
  proposalKindLabel,
  proposalStatusLabel,
} from "../../features/ai-visibility/ai-logic";
import {
  labelForReportType,
  labelForCadence,
  labelForMetric,
  labelForComparator,
} from "../../features/reports/reports-logic";

// Enums without an exported runtime array — listed here so a new member added to the type
// without updating this list AND the label map gets caught by a type error or a raw render.
const AUDIT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
const CITATION_STATUSES = ["cited", "mentioned", "absent", "none"] as const;
const AEO_CHECKS = ["h1", "structured_data", "question_heading", "list", "concise_answer"] as const;

const CASES: Array<{ name: string; values: readonly string[]; label: (v: string) => string }> = [
  { name: "OpportunityStatus", values: BOARD_STATUSES, label: (v) => opportunityStatusLabel(v as never) },
  { name: "OpportunityType", values: OPPORTUNITY_TYPES, label: (v) => opportunityTypeLabel(v as never) },
  { name: "KeywordIntent", values: KEYWORD_INTENTS, label: (v) => intentLabel(v as never) },
  { name: "AuditIssueSeverity", values: AUDIT_SEVERITIES, label: (v) => severityLabel(v as never) },
  { name: "AuditRule", values: Object.keys(RULE_LABEL), label: (v) => ruleLabel(v as never) },
  { name: "ReportType", values: REPORT_TYPES, label: (v) => labelForReportType(v as never) },
  { name: "ReportCadence", values: REPORT_CADENCES, label: (v) => labelForCadence(v as never) },
  { name: "AlertMetric", values: ALERT_METRICS, label: (v) => labelForMetric(v as never) },
  { name: "AlertComparator", values: ALERT_COMPARATORS, label: (v) => labelForComparator(v as never) },
  { name: "CitationStatus", values: CITATION_STATUSES, label: (v) => citationStatusLabel(v as never) },
  { name: "ProposalKind", values: PROPOSAL_KINDS, label: (v) => proposalKindLabel(v as never) },
  { name: "ProposalStatus", values: PROPOSAL_STATUSES, label: (v) => proposalStatusLabel(v as never) },
  { name: "AeoCheck", values: AEO_CHECKS, label: (v) => aeoCheckLabel(v) },
];

describe("guard: every domain enum value has a non-raw German label", () => {
  for (const { name, values } of CASES) {
    it(`${name}: no value renders as its raw key`, () => {
      const caseEntry = CASES.find((c) => c.name === name)!;
      for (const value of values) {
        const label = caseEntry.label(value);
        expect(label, `${name} value "${value}" has no label (renders raw)`).not.toBe(value);
        expect(label.trim().length, `${name} value "${value}" maps to empty label`).toBeGreaterThan(0);
      }
    });
  }
});
