import { apiDefaults } from "@seo-tool/shared-config";
import type { AuditIssue, CrawlFrontierEntry, CrawlPageSignal, DiscoveredUrl, FetchResult, FoundationJob, IndexabilityAssessment } from "@seo-tool/domain-model";
import { runCrawlWorkerCycle, type CrawlWorkerApiClient, type InternalLinkEdgeInput } from "./index.js";

const apiBaseUrl = process.env.SEO_API_BASE_URL ?? `http://localhost:${apiDefaults.port}`;
const pollIntervalMs = Number(process.env.CRAWLER_POLL_INTERVAL_MS ?? 5000);
const fetchTimeoutMs = Number(process.env.CRAWLER_FETCH_TIMEOUT_MS ?? 10000);
const fetchMaxAttempts = Number(process.env.CRAWLER_FETCH_MAX_ATTEMPTS ?? 2);
const userAgent = process.env.CRAWLER_USER_AGENT || undefined;
const runOnce = process.env.CRAWLER_ONCE === "1";
let shutdownRequested = false;

export class HttpCrawlWorkerApiClient implements CrawlWorkerApiClient {
  constructor(private readonly baseUrl = apiBaseUrl) {}

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

  recordInternalLinks(projectId: string, siteId: string, edges: InternalLinkEdgeInput[]): Promise<{ inserted: number; updated: number }> {
    return this.post(`/projects/${projectId}/sites/${siteId}/internal-links`, { edges });
  }

  completeCrawlRun(projectId: string, siteId: string, crawlRunId: string, status: "succeeded" | "failed", errorMessage?: string): Promise<unknown> {
    return this.post(`/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/complete`, { status, errorMessage });
  }

  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): Promise<FoundationJob> {
    return this.post(`/jobs/${jobId}/complete`, { status, lastError });
  }

  // --- Resumable-crawl extensions (migrations 016/017) ---

  enqueueCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, entries: Array<{ normalizedUrl: string; depth: number; discoveredFrom: string | null }>): Promise<{ enqueued: number; pending: number }> {
    return this.post(`/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/frontier`, { entries });
  }

  async claimCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, limit: number): Promise<{ items: CrawlFrontierEntry[]; pending: number }> {
    const envelope = await this.request<CrawlFrontierEntry[]>("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/frontier/claim`, { limit });
    return { items: envelope.data ?? [], pending: Number(envelope.meta?.pending ?? 0) };
  }

  completeCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, normalizedUrls: string[]): Promise<{ done: number; pending: number }> {
    return this.post(`/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/frontier/complete`, { normalizedUrls });
  }

  async countPendingCrawlFrontier(projectId: string, siteId: string, crawlRunId: string): Promise<number> {
    const envelope = await this.request<{ pending: number }>("GET", `/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/frontier`);
    return Number(envelope.data?.pending ?? 0);
  }

  recordCrawlPageSignals(projectId: string, siteId: string, crawlRunId: string, signals: Array<Omit<CrawlPageSignal, "crawlRunId">>): Promise<{ recorded: number }> {
    return this.post(`/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/page-signals`, { signals });
  }

  async listCrawlPageSignals(projectId: string, siteId: string, crawlRunId: string): Promise<CrawlPageSignal[]> {
    return (await this.request<CrawlPageSignal[]>("GET", `/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/page-signals`)).data ?? [];
  }

  createCrawlSeedJob(projectId: string, subject: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.post(`/jobs`, { projectId, type: "crawl_seed", subject, payload });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return (await this.request<T>("POST", path, body)).data as T;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<{ data?: T; meta?: Record<string, unknown> }> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null) as { data?: T; meta?: Record<string, unknown>; error?: { message?: string } } | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `${method} ${path} failed with ${response.status}`);
    }
    return { data: payload?.data, meta: payload?.meta };
  }
}

export async function runCrawlerWorkerLoop(): Promise<void> {
  const apiClient = new HttpCrawlWorkerApiClient();
  do {
    const result = await runCrawlWorkerCycle({
      apiClient,
      fetchTimeoutMs,
      retry: { maxAttempts: fetchMaxAttempts, delayMs: 100 },
      maxRedirects: 5,
      userAgent
    });
    if (result.claimed) {
      console.log(JSON.stringify({ level: "info", service: "crawler", event: "crawl_worker_cycle", ...result }));
    }
    if (!runOnce && !shutdownRequested) {
      await sleep(pollIntervalMs);
    }
  } while (!runOnce && !shutdownRequested);
  if (shutdownRequested) {
    console.log(JSON.stringify({ level: "info", service: "crawler", event: "crawl_worker_shutdown_complete" }));
  }
}

export function requestCrawlerWorkerShutdown(signal: NodeJS.Signals = "SIGTERM"): void {
  shutdownRequested = true;
  console.log(JSON.stringify({ level: "info", service: "crawler", event: "crawl_worker_shutdown_requested", signal }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (process.env.NODE_ENV !== "test") {
  process.once("SIGTERM", requestCrawlerWorkerShutdown);
  process.once("SIGINT", requestCrawlerWorkerShutdown);
  runCrawlerWorkerLoop().catch((error: unknown) => {
    console.error(JSON.stringify({ level: "error", service: "crawler", event: "crawl_worker_crash", message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
