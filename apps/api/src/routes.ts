import type { FoundationJob } from "@seo-tool/domain-model";
import type { ApiResponse } from "./http.js";
import { apiError, json } from "./http.js";
import type { BackendStore } from "./sqlite-store.js";
import { completeCrawlRunRequest, completeJobRequest, createCrawlRunRequest, createIntegrationRequest, createJobRequest, createSiteRequest, recordAuditIssuesRequest, recordDiscoveredUrlsRequest, recordFetchResultRequest, recordIndexabilityRequest } from "./request-validators.js";

export async function routeProjectChildren(store: BackendStore, method: string, pathname: string, body: unknown, requestId: string): Promise<ApiResponse> {
  const siteMatch = pathname.match(/^\/projects\/([^/]+)\/sites$/);
  if (method === "GET" && siteMatch) {
    return json(200, { data: store.listSites(siteMatch[1]) });
  }
  if (method === "POST" && siteMatch) {
    return json(201, { data: store.createSite(siteMatch[1], createSiteRequest(body)) });
  }

  const crawlRunsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/crawl-runs$/);
  if (method === "GET" && crawlRunsMatch) {
    return json(200, { data: store.listCrawlRuns(crawlRunsMatch[1], crawlRunsMatch[2]) });
  }
  if (method === "POST" && crawlRunsMatch) {
    const input = createCrawlRunRequest(body);
    return json(201, { data: store.createCrawlRun(crawlRunsMatch[1], crawlRunsMatch[2], input.trigger) });
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
    return json(200, { data: store.listAuditIssues(auditIssuesMatch[1], auditIssuesMatch[2]) });
  }
  if (method === "POST" && auditIssuesMatch) {
    const input = recordAuditIssuesRequest(body);
    const result = store.recordAuditIssues(auditIssuesMatch[1], auditIssuesMatch[2], input.issues);
    return json(201, { data: result.issues, meta: { inserted: result.inserted, updated: result.updated, resolved: result.resolved } });
  }

  const discoveredUrlsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls$/);
  if (method === "GET" && discoveredUrlsMatch) {
    return json(200, { data: store.listDiscoveredUrls(discoveredUrlsMatch[1], discoveredUrlsMatch[2]) });
  }
  if (method === "POST" && discoveredUrlsMatch) {
    const input = recordDiscoveredUrlsRequest(body);
    const result = store.recordDiscoveredUrls(discoveredUrlsMatch[1], discoveredUrlsMatch[2], input.urls);
    return json(201, { data: result.urls, meta: { inserted: result.inserted, updated: result.updated } });
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
