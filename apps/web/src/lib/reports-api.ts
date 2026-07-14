/**
 * reports-api.ts — typed, defensive server-side loader for the Reports & Alerts screen.
 *
 * SERVER-ONLY: imports api-client (which dynamically pulls the Node internal API).
 * NEVER import this module from a "use client" component — that would drag
 * node:fs/crypto into the browser bundle and break `next build`. Client islands
 * receive plain serializable props; pure helpers live in
 * `features/reports/reports-logic.ts`.
 *
 * Each request is individually try/caught → empty fallback, so an empty DB or a
 * partially-available API can never crash the page (graceful empty-states).
 *
 * Endpoints (pid = project id):
 *   GET /projects/{pid}/reports
 *   GET /projects/{pid}/report-schedules
 *   GET /projects/{pid}/alert-rules
 *   GET /projects/{pid}/alert-events
 */

import type {
  AlertEvent,
  AlertRule,
  Report,
  ReportDelivery,
  ReportSchedule,
} from "@seo-tool/domain-model";
import { apiGet } from "./api-client";
import { loadFoundationDashboardData, type FoundationDashboardData } from "./foundation-api";

export interface ReportsData extends FoundationDashboardData {
  reports: Report[];
  schedules: ReportSchedule[];
  alertRules: AlertRule[];
  alertEvents: AlertEvent[];
  latestReport: Report | null;
  /** Delivery history (send attempts + outcome) for the latest report. */
  latestReportDeliveries: ReportDelivery[];
}

function emptyDomainData(): Pick<ReportsData, "reports" | "schedules" | "alertRules" | "alertEvents" | "latestReport" | "latestReportDeliveries"> {
  return { reports: [], schedules: [], alertRules: [], alertEvents: [], latestReport: null, latestReportDeliveries: [] };
}

export async function loadReportsData(): Promise<ReportsData> {
  const dashboard = await loadFoundationDashboardData();

  if (!dashboard.connected || !dashboard.selectedProject) {
    return { ...dashboard, ...emptyDomainData() };
  }

  const projectId = dashboard.selectedProject.id;

  // Each request catches independently → an empty/missing resource never breaks the page.
  const [reports, schedules, alertRules, alertEvents] = await Promise.all([
    apiGet<Report[]>(`/projects/${projectId}/reports`).catch(() => [] as Report[]),
    apiGet<ReportSchedule[]>(`/projects/${projectId}/report-schedules`).catch(() => [] as ReportSchedule[]),
    apiGet<AlertRule[]>(`/projects/${projectId}/alert-rules`).catch(() => [] as AlertRule[]),
    apiGet<AlertEvent[]>(`/projects/${projectId}/alert-events`).catch(() => [] as AlertEvent[]),
  ]);

  const latestReport = reports[0] ?? null;
  // Delivery history for the latest report only — a bounded single call that turns the
  // previously write-only report_deliveries table into something the user can actually see.
  const latestReportDeliveries = latestReport
    ? await apiGet<ReportDelivery[]>(`/reports/${latestReport.id}/deliveries`).catch(() => [] as ReportDelivery[])
    : [];

  return {
    ...dashboard,
    reports,
    schedules,
    alertRules,
    alertEvents,
    latestReport,
    latestReportDeliveries,
  };
}
