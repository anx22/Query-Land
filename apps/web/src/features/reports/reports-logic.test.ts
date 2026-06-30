import { describe, expect, it } from "vitest";
import type { AlertEvent, AlertRule, ReportSchedule } from "@seo-tool/domain-model";
import {
  buildAlertChartModel,
  cadenceDays,
  countTriggered,
  eventSeverity,
  formatMetricValue,
  formatShortDate,
  formatTimestamp,
  isScoreMetric,
  labelForCadence,
  labelForChannel,
  labelForComparator,
  labelForMetric,
  labelForReportType,
  metricsFromRules,
  scheduleStatus,
  scheduleStatusBadge,
  scheduleStatusLabel,
  severityBadge,
  severityLabel,
} from "./reports-logic";

function makeSchedule(overrides: Partial<ReportSchedule> = {}): ReportSchedule {
  return {
    id: "sch-1",
    projectId: "proj-1",
    type: "weekly_summary",
    cadence: "weekly",
    channel: "email",
    target: "team@example.com",
    lastRunAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    id: "ev-1",
    projectId: "proj-1",
    ruleId: "rule-1",
    metric: "visibility_score",
    comparator: "lt",
    threshold: 50,
    observedValue: 42,
    triggered: true,
    evaluatedAt: "2026-06-05T10:00:00.000Z",
    ...overrides,
  };
}

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "rule-1",
    projectId: "proj-1",
    metric: "visibility_score",
    comparator: "lt",
    threshold: 50,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("labels", () => {
  it("maps report types, cadence, metric, comparator, channel", () => {
    expect(labelForReportType("authority_report")).toBe("Backlink-/Autoritäts-Bericht");
    expect(labelForCadence("monthly")).toBe("Monatlich");
    expect(labelForMetric("referring_domains")).toBe("Verweisende Domains");
    expect(labelForComparator("gte")).toBe("≥");
    expect(labelForChannel("slack")).toBe("Slack (nicht mehr unterstützt)");
    expect(labelForChannel(null)).toBe("kein Kanal");
    expect(labelForChannel("")).toBe("kein Kanal");
  });
});

describe("formatTimestamp / formatShortDate", () => {
  it("returns dash for empty and raw for invalid", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
    expect(formatShortDate(undefined)).toBe("—");
  });

  it("formats a valid ISO timestamp", () => {
    const out = formatTimestamp("2026-06-05T10:00:00.000Z");
    expect(out).toMatch(/2026/);
    expect(out).not.toBe("—");
  });
});

describe("formatMetricValue", () => {
  it("formats numbers and guards non-finite", () => {
    expect(formatMetricValue(42)).toBe("42");
    expect(formatMetricValue(Number.NaN)).toBe("—");
    expect(formatMetricValue(Infinity)).toBe("—");
  });
});

describe("scheduleStatus", () => {
  const now = new Date("2026-06-07T00:00:00.000Z");

  it("is never_run when no lastRunAt", () => {
    expect(scheduleStatus(makeSchedule({ lastRunAt: null }), now)).toBe("never_run");
  });

  it("is never_run when lastRunAt is unparseable", () => {
    expect(scheduleStatus(makeSchedule({ lastRunAt: "garbage" }), now)).toBe("never_run");
  });

  it("is active when within cadence window", () => {
    expect(scheduleStatus(makeSchedule({ cadence: "weekly", lastRunAt: "2026-06-04T00:00:00.000Z" }), now)).toBe("active");
  });

  it("is overdue when older than cadence window + grace", () => {
    expect(scheduleStatus(makeSchedule({ cadence: "weekly", lastRunAt: "2026-05-20T00:00:00.000Z" }), now)).toBe("overdue");
  });

  it("monthly cadence tolerates longer gaps", () => {
    expect(scheduleStatus(makeSchedule({ cadence: "monthly", lastRunAt: "2026-05-20T00:00:00.000Z" }), now)).toBe("active");
  });

  it("exposes labels and badge variants", () => {
    expect(scheduleStatusLabel("overdue")).toBe("Überfällig");
    expect(scheduleStatusBadge("active")).toBe("success");
    expect(scheduleStatusBadge("never_run")).toBe("");
  });
});

describe("cadenceDays", () => {
  it("returns 7 weekly / 30 monthly", () => {
    expect(cadenceDays("weekly")).toBe(7);
    expect(cadenceDays("monthly")).toBe(30);
  });
});

describe("alert severity", () => {
  it("derives severity, label, badge", () => {
    expect(eventSeverity(makeEvent({ triggered: true }))).toBe("triggered");
    expect(eventSeverity(makeEvent({ triggered: false }))).toBe("ok");
    expect(severityLabel("triggered")).toBe("Ausgelöst");
    expect(severityBadge("ok")).toBe("success");
  });

  it("counts triggered events", () => {
    expect(countTriggered([makeEvent({ triggered: true }), makeEvent({ id: "ev-2", triggered: false })])).toBe(1);
  });
});

describe("metricsFromRules", () => {
  it("returns distinct metrics in stable order", () => {
    const rules = [
      makeRule({ id: "r1", metric: "visibility_score" }),
      makeRule({ id: "r2", metric: "health_score" }),
      makeRule({ id: "r3", metric: "visibility_score" }),
    ];
    expect(metricsFromRules(rules)).toEqual(["visibility_score", "health_score"]);
  });

  it("returns empty for no rules", () => {
    expect(metricsFromRules([])).toEqual([]);
  });
});

describe("isScoreMetric", () => {
  it("flags 0–100 score metrics only", () => {
    expect(isScoreMetric("visibility_score")).toBe(true);
    expect(isScoreMetric("health_score")).toBe(true);
    expect(isScoreMetric("referring_domains")).toBe(false);
    expect(isScoreMetric("open_opportunities")).toBe(false);
  });
});

describe("buildAlertChartModel", () => {
  it("returns kind none when no events for the metric", () => {
    const model = buildAlertChartModel("visibility_score", []);
    expect(model.kind).toBe("none");
    expect(model.observedValue).toBeNull();
    expect(model.history).toEqual([]);
  });

  it("returns a gauge for a single score-metric event", () => {
    const model = buildAlertChartModel("visibility_score", [makeEvent({ observedValue: 42 })]);
    expect(model.kind).toBe("gauge");
    expect(model.observedValue).toBe(42);
    expect(model.threshold).toBe(50);
    expect(model.triggered).toBe(true);
  });

  it("returns kind none for a single non-score-metric event", () => {
    const model = buildAlertChartModel("referring_domains", [
      makeEvent({ metric: "referring_domains", comparator: "lt", threshold: 10, observedValue: 8 }),
    ]);
    expect(model.kind).toBe("none");
    expect(model.observedValue).toBe(8);
  });

  it("returns a trend for >=2 events, sorted oldest→newest, latest values surfaced", () => {
    const model = buildAlertChartModel("visibility_score", [
      makeEvent({ id: "b", evaluatedAt: "2026-06-06T00:00:00.000Z", observedValue: 60, triggered: false }),
      makeEvent({ id: "a", evaluatedAt: "2026-06-01T00:00:00.000Z", observedValue: 40, triggered: true }),
    ]);
    expect(model.kind).toBe("trend");
    expect(model.history).toEqual([40, 60]);
    expect(model.observedValue).toBe(60);
    expect(model.triggered).toBe(false);
    expect(model.historyLabels).toHaveLength(2);
  });
});
