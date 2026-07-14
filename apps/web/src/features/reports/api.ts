import type {
  AlertEvent,
  AlertRule,
  DeliveryChannel,
  Report,
  ReportCadence,
  ReportDelivery,
  ReportSchedule,
  ReportType,
} from "@seo-tool/domain-model";
import { apiDelete, apiPost } from "../../lib/api-client";

export function generateReport(projectId: string, type: ReportType): Promise<Report> {
  return apiPost<Report>(`/projects/${projectId}/reports`, { type });
}

export function deliverReport(reportId: string, channel: DeliveryChannel, target?: string): Promise<ReportDelivery> {
  return apiPost<ReportDelivery>(`/reports/${reportId}/deliver`, { channel, target });
}

export interface CreateReportScheduleInput {
  type: ReportType;
  cadence: ReportCadence;
  channel?: DeliveryChannel;
  target?: string;
}

export function createReportSchedule(projectId: string, input: CreateReportScheduleInput): Promise<ReportSchedule> {
  return apiPost<ReportSchedule>(`/projects/${projectId}/report-schedules`, input);
}

export function runDueSchedules(projectId: string): Promise<{ generated: number; reports: Report[] }> {
  return apiPost<{ generated: number; reports: Report[] }>(`/projects/${projectId}/report-schedules/run-due`, {});
}

export interface CreateAlertRuleInput {
  metric: string;
  comparator: string;
  threshold: number;
}

export function createAlertRule(projectId: string, input: CreateAlertRuleInput): Promise<AlertRule> {
  return apiPost<AlertRule>(`/projects/${projectId}/alert-rules`, input);
}

export function deleteAlertRule(projectId: string, ruleId: string): Promise<void> {
  return apiDelete(`/projects/${projectId}/alert-rules/${ruleId}`);
}

export function evaluateAlerts(projectId: string): Promise<AlertEvent[]> {
  return apiPost<AlertEvent[]>(`/projects/${projectId}/alerts/evaluate`, {});
}
