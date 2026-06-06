import { createCrawlSeedJobInput, type FoundationJob } from "@seo-tool/domain-model";
import type { ApiResponse } from "./http.js";
import { apiError, json } from "./http.js";
import type { CrawlStore, JobStore, ProjectStore, SourceMapStore } from "./sqlite-store.js";
import { completeCrawlRunRequest, completeJobRequest, createCrawlRunRequest, createIntegrationRequest, createJobRequest, createSiteRequest, recordAuditIssuesRequest, recordDiscoveredUrlsRequest, recordFetchResultRequest, recordIndexabilityRequest, scheduleCrawlSeedRequest } from "./request-validators.js";

export type ProjectChildStore = ProjectStore & CrawlStore & JobStore & SourceMapStore;

export async function routeProjectChildren(store: ProjectChildStore, method: string, pathname: string, searchParams: URLSearchParams, body: unknown, requestId: string): Promise<ApiResponse> {
  const siteMatch = pathname.match(/^\/projects\/([^/]+)\/sites$/);
  if (method === "GET" && siteMatch) {
    return json(200, { data: store.listSites(siteMatch[1]) });
  }
  if (method === "POST" && siteMatch) {
    return json(201, { data: store.createSite(siteMatch[1], createSiteRequest(body)) });
  }

  const crawlRunsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/crawl-runs$/);
  if (method === "GET" && crawlRunsMatch) {
    const page = store.listCrawlRunsPage(crawlRunsMatch[1], crawlRunsMatch[2], paginationOptions(searchParams), { status: enumQuery(searchParams, "status", ["running", "succeeded", "failed"]) });
    return json(200, { data: page.data, meta: pageMeta(page) });
  }
  if (method === "POST" && crawlRunsMatch) {
    const input = createCrawlRunRequest(body);
    return json(201, { data: store.createCrawlRun(crawlRunsMatch[1], crawlRunsMatch[2], input.trigger) });
  }

  const scheduleCrawlSeedMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/crawl-runs\/schedule$/);
  if (method === "POST" && scheduleCrawlSeedMatch) {
    const input = scheduleCrawlSeedRequest(body);
    const crawlRun = store.createCrawlRun(scheduleCrawlSeedMatch[1], scheduleCrawlSeedMatch[2], input.trigger);
    const crawlSeedJob = createCrawlSeedJobInput({ siteId: scheduleCrawlSeedMatch[2], baseUrl: input.baseUrl, crawlRunId: crawlRun.id, sitemapUrl: input.sitemapUrl });
    const result = store.createJob(scheduleCrawlSeedMatch[1], crawlSeedJob.type, crawlSeedJob.subject, { ...crawlSeedJob.payload });
    return json(result.idempotent ? 200 : 201, { data: { crawlRun, job: result.job }, idempotent: result.idempotent });
  }
  const completeCrawlRunMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/crawl-runs\/([^/]+)\/complete$/);
  if (method === "POST" && completeCrawlRunMatch) {
    const input = completeCrawlRunRequest(body);
    return json(200, { data: store.completeCrawlRun(completeCrawlRunMatch[1], completeCrawlRunMatch[2], completeCrawlRunMatch[3], input.status, input.errorMessage) });
  }

  const healthScoresMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/health-scores$/);
  if (method === "GET" && healthScoresMatch) {
    return json(200, { data: store.listHealthScores(healthScoresMatch[1], healthScoresMatch[2]) });
  }
  const computeHealthScoreMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/health-scores\/compute$/);
  if (method === "POST" && computeHealthScoreMatch) {
    return json(201, { data: store.computeHealthScore(computeHealthScoreMatch[1], computeHealthScoreMatch[2]) });
  }

  const auditIssuesMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/audit-issues$/);
  if (method === "GET" && auditIssuesMatch) {
    const page = store.listAuditIssuesPage(auditIssuesMatch[1], auditIssuesMatch[2], paginationOptions(searchParams), {
      status: enumQuery(searchParams, "status", ["open", "resolved", "all"]),
      severity: enumQuery(searchParams, "severity", ["critical", "high", "medium", "low"]),
      rule: enumQuery(searchParams, "rule", ["http_error", "redirect_chain", "missing_title", "duplicate_title", "canonical_mismatch", "broken_link"])
    });
    return json(200, { data: page.data, meta: pageMeta(page) });
  }
  if (method === "POST" && auditIssuesMatch) {
    const input = recordAuditIssuesRequest(body);
    const result = store.recordAuditIssues(auditIssuesMatch[1], auditIssuesMatch[2], input.issues, { checkedDiscoveredUrlIds: input.checkedDiscoveredUrlIds });
    return json(201, { data: result.issues, meta: { inserted: result.inserted, updated: result.updated, resolved: result.resolved } });
  }

  const issueActionMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/audit-issues\/([^/]+)\/(resolve|dismiss|reopen)$/);
  if (method === "POST" && issueActionMatch) {
    const [projectId, siteId, issueId, action] = issueActionMatch.slice(1) as [string, string, string, "resolve" | "dismiss" | "reopen"];
    const issue = action === "resolve"
      ? store.resolveAuditIssue(projectId, siteId, issueId)
      : action === "dismiss"
        ? store.dismissAuditIssue(projectId, siteId, issueId)
        : store.reopenAuditIssue(projectId, siteId, issueId);
    return json(200, { data: issue });
  }

  const discoveredUrlsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls$/);
  if (method === "GET" && discoveredUrlsMatch) {
    const page = store.listDiscoveredUrlsPage(discoveredUrlsMatch[1], discoveredUrlsMatch[2], paginationOptions(searchParams), {
      status: enumQuery(searchParams, "status", ["success", "redirect", "client_error", "server_error", "network_error"]),
      source: enumQuery(searchParams, "source", ["seed", "sitemap", "link"])
    });
    return json(200, { data: page.data, meta: pageMeta(page) });
  }
  if (method === "POST" && discoveredUrlsMatch) {
    const input = recordDiscoveredUrlsRequest(body);
    const result = store.recordDiscoveredUrls(discoveredUrlsMatch[1], discoveredUrlsMatch[2], input.urls);
    return json(201, { data: result.urls, meta: { inserted: result.inserted, updated: result.updated } });
  }

  const urlExplorerMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/url-explorer$/);
  if (method === "GET" && urlExplorerMatch) {
    const page = store.listUrlExplorerRows(urlExplorerMatch[1], urlExplorerMatch[2], paginationOptions(searchParams), {
      status: enumQuery(searchParams, "status", ["success", "redirect", "client_error", "server_error", "network_error"]),
      source: enumQuery(searchParams, "source", ["seed", "sitemap", "link"])
    });
    return json(200, { data: page.data, meta: pageMeta(page) });
  }

  const fetchResultsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls\/([^/]+)\/fetch-results$/);
  if (method === "GET" && fetchResultsMatch) {
    return json(200, { data: store.listFetchResults(fetchResultsMatch[1], fetchResultsMatch[2], fetchResultsMatch[3]) });
  }
  if (method === "POST" && fetchResultsMatch) {
    const input = recordFetchResultRequest(body);
    return json(201, { data: store.recordFetchResult(fetchResultsMatch[1], fetchResultsMatch[2], fetchResultsMatch[3], input) });
  }

  const indexabilityMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls\/([^/]+)\/indexability$/);
  if (method === "GET" && indexabilityMatch) {
    return json(200, { data: store.listIndexabilityAssessments(indexabilityMatch[1], indexabilityMatch[2], indexabilityMatch[3]) });
  }
  if (method === "POST" && indexabilityMatch) {
    const input = recordIndexabilityRequest(body);
    return json(201, { data: store.recordIndexabilityAssessment(indexabilityMatch[1], indexabilityMatch[2], indexabilityMatch[3], input) });
  }

  if (method === "GET" && pathname === "/integrations") {
    return json(200, { data: store.listIntegrations() });
  }
  if (method === "POST" && pathname === "/integrations") {
    const input = createIntegrationRequest(body);
    return json(201, { data: store.createIntegration(input.projectId, input.provider) });
  }
  if (method === "GET" && pathname === "/jobs") {
    return json(200, { data: store.listJobs() });
  }
  if (method === "POST" && pathname === "/jobs") {
    const input = createJobRequest(body);
    const result = store.createJob(input.projectId, input.type, input.subject, input.payload);
    return json(result.idempotent ? 200 : 201, { data: result.job, idempotent: result.idempotent });
  }
  if (method === "POST" && pathname === "/jobs/claim") {
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as { type?: FoundationJob["type"] } : {};
    return json(200, { data: store.claimNextJob(input.type) });
  }
  const completeJobMatch = pathname.match(/^\/jobs\/([^/]+)\/complete$/);
  if (method === "POST" && completeJobMatch) {
    const input = completeJobRequest(body);
    return json(200, { data: store.completeJob(completeJobMatch[1], input.status, input.lastError) });
  }
  if (method === "GET" && pathname === "/source-map") {
    return json(200, { data: store.listSourceMapEntries() });
  }
  return apiError(404, "not_found", "Route not found", requestId);
}

interface RoutePage<T> {
  data: T[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

function paginationOptions(searchParams: URLSearchParams): { limit?: number; offset?: number } {
  const limit = positiveInt(searchParams.get("limit"));
  const offset = cursorOffset(searchParams.get("cursor")) ?? nonNegativeInt(searchParams.get("offset"));
  return { limit, offset };
}

function pageMeta<T>(page: RoutePage<T>): Omit<RoutePage<T>, "data"> {
  return { limit: page.limit, offset: page.offset, total: page.total, nextCursor: page.nextCursor };
}

function positiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function cursorOffset(value: string | null): number | undefined {
  if (!value) return undefined;
  const direct = nonNegativeInt(value);
  if (direct !== undefined) return direct;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const match = /^offset:(\d+)$/.exec(decoded);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function enumQuery<const T extends string>(searchParams: URLSearchParams, key: string, allowed: readonly T[]): T | undefined {
  const value = searchParams.get(key);
  return value && (allowed as readonly string[]).includes(value) ? value as T : undefined;
}
