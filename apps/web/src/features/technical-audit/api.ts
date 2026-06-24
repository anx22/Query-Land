import type { AuditIssueRecord, CrawlHealthScore, CrawlRun, DiscoveredUrl, IndexabilityRecord, UrlFetchRecord } from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope, apiPost, emptyListMeta, type ListMeta } from "../../lib/api-client";
import { loadFoundationDashboardData, type FoundationDashboardData, type FoundationJob, type FoundationSite } from "../../lib/foundation-api";

export type { ListMeta };

export interface TechnicalAuditUrlRow {
  discoveredUrl: DiscoveredUrl;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
}

export interface WebVitalMetric {
  metric: string;
  value: number;
  measuredAt: string;
  sourceConfidence: string;
}

export interface TechnicalAuditData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  crawlRuns: CrawlRun[];
  crawlRunsMeta: ListMeta;
  healthScores: CrawlHealthScore[];
  auditIssues: AuditIssueRecord[];
  auditIssuesMeta: ListMeta;
  discoveredUrls: DiscoveredUrl[];
  discoveredUrlsMeta: ListMeta;
  urlExplorerRows: TechnicalAuditUrlRow[];
  urlExplorerMeta: ListMeta;
  webVitals: WebVitalMetric[];
}

export interface TechnicalAuditLoadOptions {
  issueStatus?: string;
  issueSeverity?: string;
  urlOffset?: number;
}

export interface ScheduledCrawlSeedRun {
  crawlRun: CrawlRun;
  job: FoundationJob;
}

export async function loadTechnicalAuditData(options: TechnicalAuditLoadOptions = {}): Promise<TechnicalAuditData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;
  if (!dashboard.connected || !dashboard.selectedProject || !selectedSite) {
    return emptyTechnicalAuditData(dashboard, selectedSite);
  }

  try {
    const base = `/projects/${dashboard.selectedProject.id}/sites/${selectedSite.id}`;
    const issueParams = new URLSearchParams({ limit: "25" });
    const normalizedIssueStatus = options.issueStatus && ["open", "resolved", "all"].includes(options.issueStatus) ? options.issueStatus : "open";
    issueParams.set("status", normalizedIssueStatus);
    if (options.issueSeverity && options.issueSeverity !== "all") issueParams.set("severity", options.issueSeverity);
    const urlParams = new URLSearchParams({ limit: "25", offset: String(Math.max(0, Math.trunc(options.urlOffset ?? 0))) });

    const [crawlRunsResponse, healthScores, auditIssuesResponse, discoveredUrlsResponse, urlExplorerResponse, webVitals] = await Promise.all([
      apiGetEnvelope<CrawlRun[]>(`${base}/crawl-runs?limit=10`),
      apiGet<CrawlHealthScore[]>(`${base}/health-scores`),
      apiGetEnvelope<AuditIssueRecord[]>(`${base}/audit-issues?${issueParams.toString()}`),
      apiGetEnvelope<DiscoveredUrl[]>(`${base}/discovered-urls?limit=25`),
      apiGetEnvelope<TechnicalAuditUrlRow[]>(`${base}/url-explorer?${urlParams.toString()}`),
      apiGet<WebVitalMetric[]>(`${base}/web-vitals`)
    ]);

    return {
      ...dashboard,
      selectedSite,
      crawlRuns: crawlRunsResponse.data,
      crawlRunsMeta: crawlRunsResponse.meta ?? emptyListMeta(crawlRunsResponse.data.length),
      healthScores,
      auditIssues: auditIssuesResponse.data,
      auditIssuesMeta: auditIssuesResponse.meta ?? emptyListMeta(auditIssuesResponse.data.length),
      discoveredUrls: discoveredUrlsResponse.data,
      discoveredUrlsMeta: discoveredUrlsResponse.meta ?? emptyListMeta(discoveredUrlsResponse.data.length),
      urlExplorerRows: urlExplorerResponse.data,
      urlExplorerMeta: urlExplorerResponse.meta ?? emptyListMeta(urlExplorerResponse.data.length),
      webVitals
    };
  } catch (error) {
    return {
      ...emptyTechnicalAuditData(dashboard, selectedSite),
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Technical-Audit-Daten konnten nicht geladen werden."
    };
  }
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

export async function dismissAuditIssue(projectId: string, siteId: string, issueId: string): Promise<AuditIssueRecord> {
  return updateAuditIssue(projectId, siteId, issueId, "dismiss");
}

export async function reopenAuditIssue(projectId: string, siteId: string, issueId: string): Promise<AuditIssueRecord> {
  return updateAuditIssue(projectId, siteId, issueId, "reopen");
}

function updateAuditIssue(projectId: string, siteId: string, issueId: string, action: "resolve" | "dismiss" | "reopen"): Promise<AuditIssueRecord> {
  return apiPost<AuditIssueRecord>(`/projects/${projectId}/sites/${siteId}/audit-issues/${issueId}/${action}`, {});
}

function emptyTechnicalAuditData(dashboard: FoundationDashboardData, selectedSite: FoundationSite | null): TechnicalAuditData {
  return {
    ...dashboard,
    selectedSite,
    crawlRuns: [],
    crawlRunsMeta: emptyListMeta(),
    healthScores: [],
    auditIssues: [],
    auditIssuesMeta: emptyListMeta(),
    discoveredUrls: [],
    discoveredUrlsMeta: emptyListMeta(),
    urlExplorerRows: [],
    urlExplorerMeta: emptyListMeta(),
    webVitals: []
  };
}
