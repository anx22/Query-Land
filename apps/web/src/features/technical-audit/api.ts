import type { AuditIssueHistoryEntry, AuditIssueRecord, CrawlHealthScore, CrawlRun } from "@seo-tool/domain-model";
import { apiGet, apiPost } from "../../lib/api-client";
import type { FoundationJob } from "../../lib/foundation-api";

// Mutating Technical-Audit operations used by the server actions. The read path
// lives in lib/audit-api.ts (loadTechnicalAuditOverview).

export interface ScheduledCrawlSeedRun {
  crawlRun: CrawlRun;
  job: FoundationJob;
}

export async function scheduleCrawlSeedRun(projectId: string, siteId: string, baseUrl: string): Promise<ScheduledCrawlSeedRun> {
  return apiPost<ScheduledCrawlSeedRun>(`/projects/${projectId}/sites/${siteId}/crawl-runs/schedule`, { trigger: "manual", baseUrl });
}

export async function computeCrawlHealthScore(projectId: string, siteId: string): Promise<CrawlHealthScore> {
  return apiPost<CrawlHealthScore>(`/projects/${projectId}/sites/${siteId}/health-scores/compute`, {});
}

export async function resolveAuditIssue(projectId: string, siteId: string, issueId: string): Promise<AuditIssueRecord> {
  return updateAuditIssue(projectId, siteId, issueId, "resolve");
}

export async function dismissAuditIssue(projectId: string, siteId: string, issueId: string, reason?: string): Promise<AuditIssueRecord> {
  const body = reason && reason.trim() !== "" ? { reason: reason.trim() } : {};
  return apiPost<AuditIssueRecord>(`/projects/${projectId}/sites/${siteId}/audit-issues/${issueId}/dismiss`, body);
}

export async function reopenAuditIssue(projectId: string, siteId: string, issueId: string): Promise<AuditIssueRecord> {
  return updateAuditIssue(projectId, siteId, issueId, "reopen");
}

export async function loadAuditIssueHistory(projectId: string, siteId: string, issueId: string): Promise<AuditIssueHistoryEntry[]> {
  return apiGet<AuditIssueHistoryEntry[]>(`/projects/${projectId}/sites/${siteId}/audit-issues/${issueId}/history`);
}

function updateAuditIssue(projectId: string, siteId: string, issueId: string, action: "resolve" | "dismiss" | "reopen"): Promise<AuditIssueRecord> {
  return apiPost<AuditIssueRecord>(`/projects/${projectId}/sites/${siteId}/audit-issues/${issueId}/${action}`, {});
}
