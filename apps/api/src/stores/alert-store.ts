import { randomUUID } from "node:crypto";
import { compareAlert, type AlertComparator, type AlertEvent, type AlertMetric, type AlertRule } from "@seo-tool/domain-model";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

const ALERT_METRICS: readonly AlertMetric[] = ["visibility_score", "health_score", "open_opportunities", "referring_domains"];
const ALERT_COMPARATORS: readonly AlertComparator[] = ["lt", "lte", "gt", "gte"];

export interface AlertRuleInput {
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
}

export interface AlertStore {
  createAlertRule(projectId: string, input: AlertRuleInput): AlertRule;
  listAlertRules(projectId: string): AlertRule[];
  deleteAlertRule(projectId: string, ruleId: string): { deleted: boolean };
  evaluateAlerts(projectId: string): AlertEvent[];
  listAlertEvents(projectId: string): AlertEvent[];
}

export function createAlertStore(db: SQLiteDatabase, audit: AuditLog): AlertStore {
  return new SQLiteAlertStore(db, audit);
}

class SQLiteAlertStore implements AlertStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  private assertProject(projectId: string): void {
    if (!this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId)) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
  }

  createAlertRule(projectId: string, input: AlertRuleInput): AlertRule {
    this.assertProject(projectId);
    if (!ALERT_METRICS.includes(input.metric)) {
      throw new RequestError(400, "invalid_field", `metric must be one of ${ALERT_METRICS.join(", ")}`);
    }
    if (!ALERT_COMPARATORS.includes(input.comparator)) {
      throw new RequestError(400, "invalid_field", `comparator must be one of ${ALERT_COMPARATORS.join(", ")}`);
    }
    if (typeof input.threshold !== "number" || Number.isNaN(input.threshold)) {
      throw new RequestError(400, "invalid_field", "threshold must be a number");
    }
    const rule: AlertRule = {
      id: `alert-${randomUUID()}`,
      projectId,
      metric: input.metric,
      comparator: input.comparator,
      threshold: input.threshold,
      createdAt: new Date().toISOString()
    };
    this.db.prepare(`INSERT INTO alert_rules (id, project_id, metric, comparator, threshold, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      rule.id, rule.projectId, rule.metric, rule.comparator, rule.threshold, rule.createdAt
    );
    this.audit("system", "alert_rule.create", "alert_rule", rule.id, { projectId, metric: rule.metric });
    return rule;
  }

  listAlertRules(projectId: string): AlertRule[] {
    return this.db.prepare(`SELECT * FROM alert_rules WHERE project_id = ? ORDER BY created_at ASC, id ASC`).all(projectId).map((row) => this.mapRule(row as Record<string, unknown>));
  }

  deleteAlertRule(projectId: string, ruleId: string): { deleted: boolean } {
    this.assertProject(projectId);
    const existing = this.db.prepare(`SELECT 1 FROM alert_rules WHERE id = ? AND project_id = ?`).get(ruleId, projectId);
    if (!existing) {
      throw new RequestError(404, "unknown_alert_rule", "Alert rule not found for project");
    }
    this.db.prepare(`DELETE FROM alert_rules WHERE id = ?`).run(ruleId);
    this.audit("system", "alert_rule.delete", "alert_rule", ruleId, { projectId });
    return { deleted: true };
  }

  // Aktueller projektweiter Kennzahlwert je Metrik (fehlende Daten -> 0).
  private observe(projectId: string, metric: AlertMetric): number {
    switch (metric) {
      case "visibility_score": {
        const row = this.db.prepare(`SELECT score FROM visibility_scores WHERE project_id = ? ORDER BY computed_at DESC LIMIT 1`).get(projectId) as { score?: number } | undefined;
        return row && typeof row.score === "number" ? row.score : 0;
      }
      case "health_score": {
        const row = this.db.prepare(`SELECT score FROM crawl_health_scores WHERE project_id = ? ORDER BY generated_at DESC LIMIT 1`).get(projectId) as { score?: number } | undefined;
        return row && typeof row.score === "number" ? row.score : 0;
      }
      case "open_opportunities":
        return Number((this.db.prepare(`SELECT COUNT(*) AS c FROM opportunities WHERE project_id = ? AND status NOT IN ('dismissed', 'expired', 'validated')`).get(projectId) as { c: number }).c);
      case "referring_domains": {
        const row = this.db.prepare(`SELECT referring_domains FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, rowid DESC LIMIT 1`).get(projectId) as { referring_domains?: number } | undefined;
        return row && typeof row.referring_domains === "number" ? row.referring_domains : 0;
      }
      default:
        return 0;
    }
  }

  evaluateAlerts(projectId: string): AlertEvent[] {
    this.assertProject(projectId);
    const rules = this.listAlertRules(projectId);
    const evaluatedAt = new Date().toISOString();
    const events: AlertEvent[] = [];
    const insert = this.db.prepare(`INSERT INTO alert_events (id, project_id, rule_id, metric, comparator, threshold, observed_value, triggered, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const rule of rules) {
      const observedValue = this.observe(projectId, rule.metric);
      const triggered = compareAlert(observedValue, rule.comparator, rule.threshold);
      const event: AlertEvent = {
        id: `aevt-${randomUUID()}`,
        projectId,
        ruleId: rule.id,
        metric: rule.metric,
        comparator: rule.comparator,
        threshold: rule.threshold,
        observedValue,
        triggered,
        evaluatedAt
      };
      insert.run(event.id, event.projectId, event.ruleId, event.metric, event.comparator, event.threshold, event.observedValue, triggered ? 1 : 0, event.evaluatedAt);
      events.push(event);
    }
    this.audit("system", "alerts.evaluate", "project", projectId, { rules: rules.length, triggered: events.filter((event) => event.triggered).length });
    return events;
  }

  listAlertEvents(projectId: string): AlertEvent[] {
    return this.db.prepare(`SELECT * FROM alert_events WHERE project_id = ? ORDER BY evaluated_at DESC, id DESC`).all(projectId).map((row) => this.mapEvent(row as Record<string, unknown>));
  }

  private mapRule(row: Record<string, unknown>): AlertRule {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      metric: String(row.metric) as AlertMetric,
      comparator: String(row.comparator) as AlertComparator,
      threshold: Number(row.threshold),
      createdAt: String(row.created_at)
    };
  }

  private mapEvent(row: Record<string, unknown>): AlertEvent {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      ruleId: String(row.rule_id),
      metric: String(row.metric) as AlertMetric,
      comparator: String(row.comparator) as AlertComparator,
      threshold: Number(row.threshold),
      observedValue: Number(row.observed_value),
      triggered: Number(row.triggered) === 1,
      evaluatedAt: String(row.evaluated_at)
    };
  }
}
