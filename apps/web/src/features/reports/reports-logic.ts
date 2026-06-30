/**
 * reports-logic.ts — pure, API-free helpers for the Reports & Alerts screen (UX, Modul I).
 *
 * Deliberately imports NO api-client/server module, so the client islands (and the
 * server page) can import these helpers WITHOUT pulling the Node-only internal API
 * (node:fs/crypto) into the browser bundle. The data loader lives in
 * `lib/reports-api.ts`; client islands receive plain serializable props.
 *
 * All functions here are pure formatters/derivations — directly unit-testable.
 */

import type {
  AlertComparator,
  AlertEvent,
  AlertMetric,
  AlertRule,
  ReportCadence,
  ReportSchedule,
  ReportType,
} from "@seo-tool/domain-model";

// ---------------------------------------------------------------------------
// Labels — Serious-Zone: factual German, no metaphor.
// ---------------------------------------------------------------------------

export function labelForReportType(type: ReportType): string {
  switch (type) {
    case "weekly_summary":
      return "Wochenzusammenfassung";
    case "opportunity_digest":
      return "Opportunity-Digest";
    case "authority_report":
      return "Authority-Report";
    default:
      return type;
  }
}

export function labelForCadence(cadence: ReportCadence): string {
  switch (cadence) {
    case "weekly":
      return "Wöchentlich";
    case "monthly":
      return "Monatlich";
    default:
      return cadence;
  }
}

export function labelForMetric(metric: AlertMetric): string {
  switch (metric) {
    case "visibility_score":
      return "Sichtbarkeits-Score";
    case "health_score":
      return "Health-Score";
    case "open_opportunities":
      return "Offene Opportunities";
    case "referring_domains":
      return "Verweisende Domains";
    default:
      return metric;
  }
}

export function labelForComparator(comparator: AlertComparator): string {
  switch (comparator) {
    case "lt":
      return "<";
    case "lte":
      return "≤";
    case "gt":
      return ">";
    case "gte":
      return "≥";
    default:
      return comparator;
  }
}

export function labelForChannel(channel: string | null | undefined): string {
  switch (channel) {
    case "email":
      return "E-Mail";
    case "webhook":
      return "Webhook";
    case "slack":
      return "Slack";
    case null:
    case undefined:
    case "":
      return "kein Kanal";
    default:
      return channel;
  }
}

// ---------------------------------------------------------------------------
// Date / timestamp formatting (de-DE; defensive against bad input).
// ---------------------------------------------------------------------------

/** Format an ISO timestamp as `dd.mm.yyyy, hh:mm`. Falls back to the raw string. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short date `dd.mm.` for chart axis labels. Falls back to the raw string. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

// ---------------------------------------------------------------------------
// Metric numeric formatting (de-DE; scores rounded, ratios as-is).
// ---------------------------------------------------------------------------

export function formatMetricValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// Schedule status (cadence freshness; no backend "active" flag exists).
// ---------------------------------------------------------------------------

export type ScheduleStatus = "never_run" | "active" | "overdue";

/** Cadence in days — used to derive overdue status from `lastRunAt`. */
export function cadenceDays(cadence: ReportCadence): number {
  return cadence === "monthly" ? 30 : 7;
}

/**
 * Derive a schedule status: a schedule that has never run is `never_run`;
 * one whose last run is older than its cadence window (+ grace) is `overdue`;
 * otherwise `active`. `now` is injectable for deterministic tests.
 */
export function scheduleStatus(schedule: ReportSchedule, now: Date = new Date()): ScheduleStatus {
  if (!schedule.lastRunAt) return "never_run";
  const last = new Date(schedule.lastRunAt);
  if (Number.isNaN(last.getTime())) return "never_run";
  const ageDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  // One full cadence window + a small grace before a schedule counts as overdue.
  const grace = 1;
  return ageDays > cadenceDays(schedule.cadence) + grace ? "overdue" : "active";
}

export function scheduleStatusLabel(status: ScheduleStatus): string {
  switch (status) {
    case "never_run":
      return "Noch nie ausgeführt";
    case "active":
      return "Aktiv";
    case "overdue":
      return "Überfällig";
  }
}

/** Map a schedule status to a global badge variant class suffix. */
export function scheduleStatusBadge(status: ScheduleStatus): string {
  switch (status) {
    case "never_run":
      return "";
    case "active":
      return "success";
    case "overdue":
      return "danger";
  }
}

// ---------------------------------------------------------------------------
// Alert severity (factual; "triggered" is the only hard signal we have).
// ---------------------------------------------------------------------------

export type AlertSeverity = "triggered" | "ok";

export function eventSeverity(event: AlertEvent): AlertSeverity {
  return event.triggered ? "triggered" : "ok";
}

export function severityLabel(severity: AlertSeverity): string {
  return severity === "triggered" ? "Ausgelöst" : "Im grünen Bereich";
}

export function severityBadge(severity: AlertSeverity): string {
  return severity === "triggered" ? "danger" : "success";
}

// ---------------------------------------------------------------------------
// Metric vs. threshold — gauge/trend mapping (Serious-Zone).
// ---------------------------------------------------------------------------

/** Metrics scored on a 0–100 scale → suitable for a ScoreGauge. */
const SCORE_METRICS: ReadonlySet<AlertMetric> = new Set<AlertMetric>([
  "visibility_score",
  "health_score",
]);

export function isScoreMetric(metric: AlertMetric): boolean {
  return SCORE_METRICS.has(metric);
}

export interface AlertChartModel {
  /** "gauge" for 0–100 score metrics, "trend" for time-series, "none" otherwise. */
  kind: "gauge" | "trend" | "none";
  metric: AlertMetric;
  /** Most recent observed value for the metric. */
  observedValue: number | null;
  /** The rule threshold (from the latest matching event). */
  threshold: number | null;
  comparator: AlertComparator | null;
  /** Whether the latest evaluation triggered. */
  triggered: boolean;
  /** Oldest → newest observed values, for trend/sparkline. */
  history: number[];
  /** Short date labels aligned with `history`. */
  historyLabels: string[];
}

/**
 * Build a chart model for a single metric from its alert events.
 * - 0–100 score metrics with ≤1 data point → gauge (metric vs. threshold).
 * - any metric with ≥2 evaluated events → trend (mini time-series).
 * - otherwise → none (fall back to a factual list).
 *
 * Events may arrive in any order; this sorts ascending by `evaluatedAt`.
 */
export function buildAlertChartModel(metric: AlertMetric, events: AlertEvent[]): AlertChartModel {
  const forMetric = events
    .filter((e) => e.metric === metric)
    .slice()
    .sort((a, b) => new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime());

  if (forMetric.length === 0) {
    return {
      kind: "none",
      metric,
      observedValue: null,
      threshold: null,
      comparator: null,
      triggered: false,
      history: [],
      historyLabels: [],
    };
  }

  const latest = forMetric[forMetric.length - 1];
  const history = forMetric.map((e) => e.observedValue);
  const historyLabels = forMetric.map((e) => formatShortDate(e.evaluatedAt));

  let kind: AlertChartModel["kind"];
  if (forMetric.length >= 2) {
    kind = "trend";
  } else if (isScoreMetric(metric)) {
    kind = "gauge";
  } else {
    kind = "none";
  }

  return {
    kind,
    metric,
    observedValue: latest.observedValue,
    threshold: latest.threshold,
    comparator: latest.comparator,
    triggered: latest.triggered,
    history,
    historyLabels,
  };
}

/** Distinct metrics present across the given alert rules (stable order). */
export function metricsFromRules(rules: AlertRule[]): AlertMetric[] {
  const seen = new Set<AlertMetric>();
  const out: AlertMetric[] = [];
  for (const rule of rules) {
    if (!seen.has(rule.metric)) {
      seen.add(rule.metric);
      out.push(rule.metric);
    }
  }
  return out;
}

/** Count triggered events. */
export function countTriggered(events: AlertEvent[]): number {
  return events.filter((e) => e.triggered).length;
}
