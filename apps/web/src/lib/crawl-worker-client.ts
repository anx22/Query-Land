import type { AuditIssue, DiscoveredUrl, FetchResult, FoundationJob, IndexabilityAssessment } from "@seo-tool/domain-model";
import type { CrawlWorkerApiClient } from "@seo-tool/crawler";

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiCaller = (method: string, path: string, body?: unknown) => Promise<ApiResponse>;

/**
 * Drives the crawl worker against the embedded API in the same process — no HTTP
 * round-trip. On Vercel there is no long-running worker daemon; a scheduled
 * function (see app/api/cron/crawl) uses this client to drain the job queue.
 *
 * Mirrors HttpCrawlWorkerApiClient (services/crawler/src/worker.ts) so the crawl
 * cycle behaves identically; only the transport differs.
 */
export class InProcessCrawlWorkerApiClient implements CrawlWorkerApiClient {
  constructor(private readonly call: ApiCaller) {}

  claimNextJob(): Promise<FoundationJob | null> {
    return this.post<FoundationJob | null>("/jobs/claim", { type: "crawl_seed" });
  }

  createCrawlRun(projectId: string, siteId: string, trigger: "manual" | "scheduled" | "deploy"): Promise<{ id: string }> {
    return this.post(`/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger });
  }

  recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): Promise<DiscoveredUrl[]> {
    return this.post(`/projects/${projectId}/sites/${siteId}/discovered-urls`, { urls });
  }

  recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: FetchResult): Promise<FetchResult & { id: string }> {
    return this.post(`/projects/${projectId}/sites/${siteId}/discovered-urls/${discoveredUrlId}/fetch-results`, result);
  }

  recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: IndexabilityAssessment & { fetchResultId: string | null; assessedAt: string }): Promise<unknown> {
    return this.post(`/projects/${projectId}/sites/${siteId}/discovered-urls/${discoveredUrlId}/indexability`, assessment);
  }

  recordAuditIssues(projectId: string, siteId: string, issues: Array<AuditIssue & { projectId: string; siteId: string; discoveredUrlId: string | null; detectedAt: string; resolvedAt: string | null }>, checkedDiscoveredUrlIds: string[]): Promise<unknown> {
    return this.post(`/projects/${projectId}/sites/${siteId}/audit-issues`, { issues, checkedDiscoveredUrlIds });
  }

  computeHealthScore(projectId: string, siteId: string): Promise<unknown> {
    return this.post(`/projects/${projectId}/sites/${siteId}/health-scores/compute`, {});
  }

  completeCrawlRun(projectId: string, siteId: string, crawlRunId: string, status: "succeeded" | "failed", errorMessage?: string): Promise<unknown> {
    return this.post(`/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/complete`, { status, errorMessage });
  }

  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): Promise<FoundationJob> {
    return this.post(`/jobs/${jobId}/complete`, { status, lastError });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.call("POST", path, body);
    const payload = response.body as { data?: T; error?: { message?: string } } | null;
    if (response.status >= 400) {
      throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
    }
    return payload?.data as T;
  }
}
