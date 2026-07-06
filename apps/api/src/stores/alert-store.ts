import { randomUUID } from "node:crypto";
import { ALERT_CHANNELS, ALERT_COMPARATORS, ALERT_METRICS, compareAlert, type AlertChannel, type AlertComparator, type AlertEvent, type AlertMetric, type AlertRule } from "@seo-tool/domain-model";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import { sendAlertDelivery } from "../reports/delivery.js";
import type { AsyncDatabase } from "../db/index.js";

export interface AlertRuleInput {
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  channel?: AlertChannel | null;
  target?: string | null;
}

export interface AlertStore {
  createAlertRule(projectId: string, input: AlertRuleInput): Promise<AlertRule>;
  listAlertRules(projectId: string): Promise<AlertRule[]>;
  deleteAlertRule(projectId: string, ruleId: string): Promise<{ deleted: boolean }>;
  evaluateAlerts(projectId: string): Promise<AlertEvent[]>;
  listAlertEvents(projectId: string): Promise<AlertEvent[]>;
}

export function createAlertStore(db: AsyncDatabase, audit: AuditLog): AlertStore {
  return new SQLiteAlertStore(db, audit);
}

class SQLiteAlertStore implements AlertStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  private async assertProject(projectId: string): Promise<void> {
    if (!(await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId))) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
  }

  async createAlertRule(projectId: string, input: AlertRuleInput): Promise<AlertRule> {
    await this.assertProject(projectId);
    if (!ALERT_METRICS.includes(input.metric)) {
      throw new RequestError(400, "invalid_field", `metric must be one of ${ALERT_METRICS.join(", ")}`);
    }
    if (!ALERT_COMPARATORS.includes(input.comparator)) {
      throw new RequestError(400, "invalid_field", `comparator must be one of ${ALERT_COMPARATORS.join(", ")}`);
    }
    if (typeof input.threshold !== "number" || Number.isNaN(input.threshold)) {
      throw new RequestError(400, "invalid_field", "threshold must be a number");
    }
    const channel = input.channel ?? null;
    if (channel !== null && !ALERT_CHANNELS.includes(channel)) {
      throw new RequestError(400, "invalid_field", `channel must be one of ${ALERT_CHANNELS.join(", ")}`);
    }
    const target = input.target && input.target.trim() !== "" ? input.target.trim() : null;
    if (channel !== null && !target) {
      throw new RequestError(400, "invalid_field", "target is required when a delivery channel is set");
    }
    const rule: AlertRule = {
      id: `alert-${randomUUID()}`,
      projectId,
      metric: input.metric,
      comparator: input.comparator,
      threshold: input.threshold,
      channel,
      target,
      createdAt: new Date().toISOString()
    };
    await this.db.prepare(`INSERT INTO alert_rules (id, project_id, metric, comparator, threshold, channel, target, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      rule.id, rule.projectId, rule.metric, rule.comparator, rule.threshold, rule.channel, rule.target, rule.createdAt
    );
    await this.audit("system", "alert_rule.create", "alert_rule", rule.id, { projectId, metric: rule.metric });
    return rule;
  }

  async listAlertRules(projectId: string): Promise<AlertRule[]> {
    return (await this.db.prepare(`SELECT * FROM alert_rules WHERE project_id = ? ORDER BY created_at ASC, id ASC`).all(projectId)).map((row) => this.mapRule(row as Record<string, unknown>));
  }

  async deleteAlertRule(projectId: string, ruleId: string): Promise<{ deleted: boolean }> {
    await this.assertProject(projectId);
    const existing = await this.db.prepare(`SELECT 1 FROM alert_rules WHERE id = ? AND project_id = ?`).get(ruleId, projectId);
    if (!existing) {
      throw new RequestError(404, "unknown_alert_rule", "Alert rule not found for project");
    }
    await this.db.prepare(`DELETE FROM alert_rules WHERE id = ?`).run(ruleId);
    await this.audit("system", "alert_rule.delete", "alert_rule", ruleId, { projectId });
    return { deleted: true };
  }

  // Aktueller projektweiter Kennzahlwert je Metrik (fehlende Daten -> 0).
  private async observe(projectId: string, metric: AlertMetric): Promise<number> {
    switch (metric) {
      case "visibility_score": {
        const row = await this.db.prepare(`SELECT score FROM visibility_scores WHERE project_id = ? ORDER BY computed_at DESC LIMIT 1`).get(projectId) as { score?: number } | undefined;
        return row && typeof row.score === "number" ? row.score : 0;
      }
      case "health_score": {
        const row = await this.db.prepare(`SELECT score FROM crawl_health_scores WHERE project_id = ? ORDER BY generated_at DESC LIMIT 1`).get(projectId) as { score?: number } | undefined;
        return row && typeof row.score === "number" ? row.score : 0;
      }
      case "open_opportunities":
        return Number((await this.db.prepare(`SELECT COUNT(*) AS c FROM opportunities WHERE project_id = ? AND status NOT IN ('dismissed', 'expired', 'validated')`).get(projectId) as { c: number }).c);
      case "referring_domains": {
        const row = await this.db.prepare(`SELECT referring_domains FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, seq DESC LIMIT 1`).get(projectId) as { referring_domains?: number } | undefined;
        return row && typeof row.referring_domains === "number" ? row.referring_domains : 0;
      }
      case "search_clicks": {
        // Total GSC clicks at the latest snapshot across the project's sites (traffic-drop signal).
        const row = await this.db.prepare(`
          SELECT COALESCE(SUM(spr.clicks), 0) AS c FROM search_performance_rows spr
          JOIN sites s ON s.id = spr.site_id
          WHERE s.project_id = ? AND spr.captured_at = (
            SELECT MAX(spr2.captured_at) FROM search_performance_rows spr2
            JOIN sites s2 ON s2.id = spr2.site_id WHERE s2.project_id = ?
          )
        `).get(projectId, projectId) as { c?: number } | undefined;
        return row && typeof row.c === "number" ? row.c : 0;
      }
      default:
        return 0;
    }
  }

  async evaluateAlerts(projectId: string): Promise<AlertEvent[]> {
    await this.assertProject(projectId);
    const rules = await this.listAlertRules(projectId);
    const evaluatedAt = new Date().toISOString();

    // Observe each metric BEFORE opening the transaction: these are reads, and
    // running them while a transaction is open would use a second connection —
    // a deadlock on a single-connection driver and an isolation break on a
    // pooled one. The transaction below only performs the inserts.
    const events: AlertEvent[] = [];
    for (const rule of rules) {
      const observedValue = await this.observe(projectId, rule.metric);
      const triggered = compareAlert(observedValue, rule.comparator, rule.threshold);
      events.push({
        id: `aevt-${randomUUID()}`,
        projectId,
        ruleId: rule.id,
        metric: rule.metric,
        comparator: rule.comparator,
        threshold: rule.threshold,
        observedValue,
        triggered,
        evaluatedAt
      });
    }

    await this.db.transaction(async (tx) => {
      const insert = tx.prepare(`INSERT INTO alert_events (id, project_id, rule_id, metric, comparator, threshold, observed_value, triggered, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const event of events) {
        await insert.run(event.id, event.projectId, event.ruleId, event.metric, event.comparator, event.threshold, event.observedValue, event.triggered ? 1 : 0, event.evaluatedAt);
      }
    });
    await this.audit("system", "alerts.evaluate", "project", projectId, { rules: rules.length, triggered: events.filter((event) => event.triggered).length });

    // Deliver each TRIGGERED alert whose rule names a channel + target (§M6). Delivery is best-effort
    // and never aborts evaluation — a failed send is recorded in the audit log, not thrown.
    const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
    for (const event of events) {
      if (!event.triggered) continue;
      const rule = rulesById.get(event.ruleId);
      if (!rule?.channel || !rule.target) continue;
      const result = await sendAlertDelivery(rule.channel, rule.target, {
        projectId, metric: event.metric, comparator: event.comparator, threshold: event.threshold, observedValue: event.observedValue, evaluatedAt: event.evaluatedAt
      });
      await this.audit("system", "alert.deliver", "alert_rule", rule.id, { channel: rule.channel, status: result.status, detail: result.detail });
    }
    return events;
  }

  async listAlertEvents(projectId: string): Promise<AlertEvent[]> {
    await this.assertProject(projectId);
    return (await this.db.prepare(`SELECT * FROM alert_events WHERE project_id = ? ORDER BY evaluated_at DESC, id DESC`).all(projectId)).map((row) => this.mapEvent(row as Record<string, unknown>));
  }

  private mapRule(row: Record<string, unknown>): AlertRule {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      metric: String(row.metric) as AlertMetric,
      comparator: String(row.comparator) as AlertComparator,
      threshold: Number(row.threshold),
      channel: row.channel === null || row.channel === undefined ? null : (String(row.channel) as AlertChannel),
      target: row.target === null || row.target === undefined ? null : String(row.target),
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
