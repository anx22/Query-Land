import { randomUUID } from "node:crypto";
import {
  DELIVERY_CHANNELS,
  REPORT_CADENCES,
  REPORT_TYPES,
  renderReportExport,
  type DeliveryChannel,
  type Report,
  type ReportCadence,
  type ReportDelivery,
  type ReportExport,
  type ReportExportFormat,
  type ReportSection,
  type ReportSchedule,
  type ReportType
} from "@seo-tool/domain-model";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import { sendReportDelivery } from "../reports/delivery.js";
import type { AsyncDatabase } from "../db/index.js";

const CADENCE_DAYS: Record<ReportCadence, number> = { weekly: 7, monthly: 30 };

export interface ReportScheduleInput {
  type: ReportType;
  cadence: ReportCadence;
  channel?: DeliveryChannel | null;
  target?: string | null;
}

export interface RunDueResult {
  generated: number;
  reports: Report[];
}

export interface ReportStore {
  generateReport(projectId: string, type: ReportType): Promise<Report>;
  getReport(reportId: string): Promise<Report>;
  listReports(projectId: string): Promise<Report[]>;
  exportReport(reportId: string, format: ReportExportFormat): Promise<ReportExport>;
  deliverReport(reportId: string, channel: DeliveryChannel, target?: string | null): Promise<ReportDelivery>;
  listReportDeliveries(reportId: string): Promise<ReportDelivery[]>;
  createReportSchedule(projectId: string, input: ReportScheduleInput): Promise<ReportSchedule>;
  listReportSchedules(projectId: string): Promise<ReportSchedule[]>;
  runDueReportSchedules(projectId: string): Promise<RunDueResult>;
}

export function createReportStore(db: AsyncDatabase, audit: AuditLog): ReportStore {
  return new SQLiteReportStore(db, audit);
}

class SQLiteReportStore implements ReportStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  private async requireProject(projectId: string): Promise<{ name: string }> {
    const row = await this.db.prepare(`SELECT name FROM projects WHERE id = ?`).get(projectId) as { name?: string } | undefined;
    if (!row || typeof row.name !== "string") {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    return { name: row.name };
  }

  private async count(sql: string, ...args: unknown[]): Promise<number> {
    const row = await this.db.prepare(sql).get(...args) as { c?: number } | undefined;
    return Number(row?.c ?? 0);
  }

  private async overviewSection(projectId: string): Promise<ReportSection> {
    const sites = await this.count(`SELECT COUNT(*) AS c FROM sites WHERE project_id = ?`, projectId);
    const health = await this.db.prepare(`SELECT score FROM crawl_health_scores WHERE project_id = ? ORDER BY generated_at DESC LIMIT 1`).get(projectId) as { score?: number } | undefined;
    const openOpportunities = await this.count(`SELECT COUNT(*) AS c FROM opportunities WHERE project_id = ? AND status NOT IN ('dismissed', 'expired', 'validated')`, projectId);
    const visibility = await this.db.prepare(`SELECT score FROM visibility_scores WHERE project_id = ? ORDER BY computed_at DESC LIMIT 1`).get(projectId) as { score?: number } | undefined;
    return {
      title: "Übersicht",
      rows: [
        { label: "Sites", value: sites },
        { label: "Health-Score", value: health?.score ?? "—" },
        { label: "Offene Opportunities", value: openOpportunities },
        { label: "Visibility-Index", value: visibility?.score ?? "—" }
      ]
    };
  }

  private async opportunitySection(projectId: string): Promise<ReportSection> {
    const byStatus = await this.db.prepare(`SELECT status, COUNT(*) AS c FROM opportunities WHERE project_id = ? GROUP BY status`).all(projectId) as Array<{ status: string; c: number }>;
    const top = await this.db.prepare(`SELECT type, priority FROM opportunities WHERE project_id = ? ORDER BY priority DESC, created_at ASC LIMIT 3`).all(projectId) as Array<{ type: string; priority: number }>;
    const rows = byStatus.map((row) => ({ label: `Status ${row.status}`, value: Number(row.c) }));
    top.forEach((row, index) => rows.push({ label: `Top ${index + 1} (${row.type})`, value: Number(row.priority) }));
    if (rows.length === 0) rows.push({ label: "Opportunities", value: 0 });
    return { title: "Opportunities", rows };
  }

  private async visibilitySection(projectId: string): Promise<ReportSection> {
    const visibility = await this.db.prepare(`SELECT score, tracked_keywords, average_position FROM visibility_scores WHERE project_id = ? ORDER BY computed_at DESC LIMIT 1`).get(projectId) as { score?: number; tracked_keywords?: number; average_position?: number | null } | undefined;
    const keywords = await this.count(`SELECT COUNT(*) AS c FROM keywords WHERE project_id = ?`, projectId);
    return {
      title: "Sichtbarkeit & Keywords",
      rows: [
        { label: "Visibility-Index", value: visibility?.score ?? "—" },
        { label: "Getrackte Keywords", value: visibility?.tracked_keywords ?? 0 },
        { label: "Ø Position", value: visibility?.average_position ?? "—" },
        { label: "Keywords gesamt", value: keywords }
      ]
    };
  }

  private async authoritySection(projectId: string): Promise<ReportSection> {
    const snapshot = await this.db.prepare(`SELECT total_backlinks, referring_domains FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, seq DESC LIMIT 1`).get(projectId) as { total_backlinks?: number; referring_domains?: number } | undefined;
    return {
      title: "Authority",
      rows: [
        { label: "Backlinks", value: snapshot?.total_backlinks ?? 0 },
        { label: "Verweisende Domains", value: snapshot?.referring_domains ?? 0 }
      ]
    };
  }

  private async buildSections(projectId: string, type: ReportType): Promise<ReportSection[]> {
    switch (type) {
      case "opportunity_digest":
        return [await this.overviewSection(projectId), await this.opportunitySection(projectId)];
      case "authority_report":
        return [await this.overviewSection(projectId), await this.authoritySection(projectId)];
      case "weekly_summary":
      default:
        return [await this.overviewSection(projectId), await this.opportunitySection(projectId), await this.visibilitySection(projectId), await this.authoritySection(projectId)];
    }
  }

  private titleFor(type: ReportType, projectName: string): string {
    const label = type === "weekly_summary" ? "Wochenreport" : type === "opportunity_digest" ? "Opportunity Digest" : "Authority Report";
    return `${label} · ${projectName}`;
  }

  async generateReport(projectId: string, type: ReportType): Promise<Report> {
    const { name } = await this.requireProject(projectId);
    if (!REPORT_TYPES.includes(type)) {
      throw new RequestError(400, "invalid_field", `type must be one of ${REPORT_TYPES.join(", ")}`);
    }
    const sections = await this.buildSections(projectId, type);
    const report: Report = {
      id: `rep-${randomUUID()}`,
      projectId,
      type,
      title: this.titleFor(type, name),
      sections,
      generatedAt: new Date().toISOString()
    };
    await this.db.prepare(`INSERT INTO reports (id, project_id, type, title, sections, generated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      report.id, report.projectId, report.type, report.title, JSON.stringify(report.sections), report.generatedAt
    );
    await this.audit("system", "report.generate", "report", report.id, { projectId, type });
    return report;
  }

  async getReport(reportId: string): Promise<Report> {
    const row = await this.db.prepare(`SELECT * FROM reports WHERE id = ?`).get(reportId);
    if (!row) {
      throw new RequestError(404, "unknown_report", "Report not found");
    }
    return this.mapReport(row as Record<string, unknown>);
  }

  async listReports(projectId: string): Promise<Report[]> {
    await this.requireProject(projectId);
    return (await this.db.prepare(`SELECT * FROM reports WHERE project_id = ? ORDER BY generated_at DESC, id DESC`).all(projectId)).map((row) => this.mapReport(row as Record<string, unknown>));
  }

  async exportReport(reportId: string, format: ReportExportFormat): Promise<ReportExport> {
    if (format !== "csv" && format !== "html" && format !== "pdf") {
      throw new RequestError(400, "invalid_field", "format must be csv, html or pdf");
    }
    return renderReportExport(await this.getReport(reportId), format);
  }

  async deliverReport(reportId: string, channel: DeliveryChannel, target?: string | null): Promise<ReportDelivery> {
    const report = await this.getReport(reportId);
    if (!DELIVERY_CHANNELS.includes(channel)) {
      throw new RequestError(400, "invalid_field", `channel must be one of ${DELIVERY_CHANNELS.join(", ")}`);
    }
    // Real send: webhook POSTs the report; email goes via Resend when configured; otherwise the
    // result is honestly "skipped"/"failed" — never a faked "sent" (DEC-002 stub retired).
    const result = await sendReportDelivery(channel, target, report);
    const delivery: ReportDelivery = {
      id: `del-${randomUUID()}`,
      reportId,
      channel,
      target: target && target.trim() !== "" ? target.trim() : null,
      status: result.status,
      deliveredAt: new Date().toISOString()
    };
    await this.db.prepare(`INSERT INTO report_deliveries (id, report_id, channel, target, status, delivered_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      delivery.id, delivery.reportId, delivery.channel, delivery.target, delivery.status, delivery.deliveredAt
    );
    await this.audit("system", "report.deliver", "report", reportId, { channel, status: delivery.status, detail: result.detail });
    return delivery;
  }

  async listReportDeliveries(reportId: string): Promise<ReportDelivery[]> {
    await this.getReport(reportId);
    return (await this.db.prepare(`SELECT * FROM report_deliveries WHERE report_id = ? ORDER BY delivered_at DESC, id DESC`).all(reportId)).map((row) => ({
      id: String(row.id),
      reportId: String(row.report_id),
      channel: String(row.channel) as DeliveryChannel,
      target: row.target === null || row.target === undefined ? null : String(row.target),
      status: String(row.status),
      deliveredAt: String(row.delivered_at)
    }));
  }

  async createReportSchedule(projectId: string, input: ReportScheduleInput): Promise<ReportSchedule> {
    await this.requireProject(projectId);
    if (!REPORT_TYPES.includes(input.type)) {
      throw new RequestError(400, "invalid_field", `type must be one of ${REPORT_TYPES.join(", ")}`);
    }
    if (!REPORT_CADENCES.includes(input.cadence)) {
      throw new RequestError(400, "invalid_field", `cadence must be one of ${REPORT_CADENCES.join(", ")}`);
    }
    const channel = input.channel && DELIVERY_CHANNELS.includes(input.channel) ? input.channel : null;
    const schedule: ReportSchedule = {
      id: `sched-${randomUUID()}`,
      projectId,
      type: input.type,
      cadence: input.cadence,
      channel,
      target: input.target && input.target.trim() !== "" ? input.target.trim() : null,
      lastRunAt: null,
      createdAt: new Date().toISOString()
    };
    await this.db.prepare(`INSERT INTO report_schedules (id, project_id, type, cadence, channel, target, last_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      schedule.id, schedule.projectId, schedule.type, schedule.cadence, schedule.channel, schedule.target, schedule.lastRunAt, schedule.createdAt
    );
    await this.audit("system", "report_schedule.create", "report_schedule", schedule.id, { projectId, type: schedule.type, cadence: schedule.cadence });
    return schedule;
  }

  async listReportSchedules(projectId: string): Promise<ReportSchedule[]> {
    await this.requireProject(projectId);
    return (await this.db.prepare(`SELECT * FROM report_schedules WHERE project_id = ? ORDER BY created_at ASC, id ASC`).all(projectId)).map((row) => this.mapSchedule(row as Record<string, unknown>));
  }

  // Automatisierung (Gate "Wochenreport automatisiert"): erzeugt für jeden fälligen Schedule einen
  // Report (idempotent je Fälligkeit), liefert ihn bei gesetztem Kanal aus und markiert last_run_at.
  // Ein echter Cron-Trigger (Worker) ist Follow-up (GAP-REPORT-003).
  async runDueReportSchedules(projectId: string): Promise<RunDueResult> {
    await this.requireProject(projectId);
    const now = Date.now();
    const schedules = await this.listReportSchedules(projectId);
    const reports: Report[] = [];
    // No outer transaction here: generateReport/deliverReport each run their own
    // transactions, and nesting them on a single-connection driver deadlocks.
    // Each report generation is atomic on its own; the per-schedule timestamp
    // update is a single statement applied right after.
    for (const schedule of schedules) {
      const lastRun = schedule.lastRunAt === null ? NaN : Date.parse(schedule.lastRunAt);
      // null oder unparsebar -> fällig (ein korruptes last_run_at darf einen Schedule nicht für immer blockieren).
      const due = schedule.lastRunAt === null || Number.isNaN(lastRun) || (now - lastRun) >= CADENCE_DAYS[schedule.cadence] * 24 * 60 * 60 * 1000;
      if (!due) continue;
      const report = await this.generateReport(projectId, schedule.type);
      if (schedule.channel) {
        await this.deliverReport(report.id, schedule.channel, schedule.target);
      }
      await this.db.prepare(`UPDATE report_schedules SET last_run_at = ? WHERE id = ?`).run(new Date().toISOString(), schedule.id);
      reports.push(report);
    }
    await this.audit("system", "report_schedule.run_due", "project", projectId, { generated: reports.length });
    return { generated: reports.length, reports };
  }

  private mapReport(row: Record<string, unknown>): Report {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      type: String(row.type) as ReportType,
      title: String(row.title),
      sections: JSON.parse(String(row.sections)) as ReportSection[],
      generatedAt: String(row.generated_at)
    };
  }

  private mapSchedule(row: Record<string, unknown>): ReportSchedule {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      type: String(row.type) as ReportType,
      cadence: String(row.cadence) as ReportCadence,
      channel: row.channel === null || row.channel === undefined ? null : String(row.channel) as DeliveryChannel,
      target: row.target === null || row.target === undefined ? null : String(row.target),
      lastRunAt: row.last_run_at === null || row.last_run_at === undefined ? null : String(row.last_run_at),
      createdAt: String(row.created_at)
    };
  }
}
