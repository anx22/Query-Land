// Core Web Vitals thresholds + rating (Master-Spec §5 M2). Turns the raw PSI metrics
// (psi_lcp_ms / psi_cls / psi_inp_ms / psi_ttfb_ms, persisted by the pagespeed connector) into a
// good / needs-improvement / poor rating and, past the "poor" boundary, into audit issues that flow
// into the health score like any other finding. Pure + DB-independent so it is unit-testable.

import type { AuditIssueRule, AuditIssueSeverity } from "./crawl.js";

export type WebVitalRating = "good" | "needs-improvement" | "poor";

export interface WebVitalThreshold {
  /** Metric key as stored in normalized_metrics (prefix psi_). */
  metric: string;
  /** At or below `good` → good; above `poor` → poor; between → needs-improvement. */
  good: number;
  poor: number;
  rule: AuditIssueRule;
  /** Human label for messages/UI. */
  label: string;
  /** Unit suffix for messages ("ms" or ""). */
  unit: string;
}

// Google's official Core Web Vitals boundaries.
export const WEB_VITAL_THRESHOLDS: readonly WebVitalThreshold[] = [
  { metric: "psi_lcp_ms", good: 2500, poor: 4000, rule: "lcp_slow", label: "LCP", unit: "ms" },
  { metric: "psi_cls", good: 0.1, poor: 0.25, rule: "cls_high", label: "CLS", unit: "" },
  { metric: "psi_inp_ms", good: 200, poor: 500, rule: "inp_slow", label: "INP", unit: "ms" },
  { metric: "psi_ttfb_ms", good: 800, poor: 1800, rule: "ttfb_slow", label: "TTFB", unit: "ms" },
];

export function rateWebVital(threshold: WebVitalThreshold, value: number): WebVitalRating {
  if (value <= threshold.good) return "good";
  if (value > threshold.poor) return "poor";
  return "needs-improvement";
}

export interface WebVitalIssue {
  rule: AuditIssueRule;
  severity: AuditIssueSeverity;
  message: string;
}

/**
 * Evaluate a set of latest web-vital metric values (keyed by metric name) into audit issues:
 * a `poor` metric is a high-severity issue, `needs-improvement` a medium one, `good` produces none.
 */
export function evaluateWebVitalIssues(latest: Record<string, number | undefined>): WebVitalIssue[] {
  const issues: WebVitalIssue[] = [];
  for (const threshold of WEB_VITAL_THRESHOLDS) {
    const value = latest[threshold.metric];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const rating = rateWebVital(threshold, value);
    if (rating === "good") continue;
    const shown = threshold.unit === "ms" ? `${Math.round(value)}${threshold.unit}` : value.toFixed(3);
    issues.push({
      rule: threshold.rule,
      severity: rating === "poor" ? "high" : "medium",
      message: `${threshold.label} is ${shown} (${rating}; good ≤ ${threshold.good}${threshold.unit}).`,
    });
  }
  return issues;
}
