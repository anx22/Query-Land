import type {
  AuditIssue,
  CrawlFrontierEntry,
  CrawlPageSignal,
  DiscoveredUrl,
  FetchResult,
  FoundationJob,
  IndexabilityAssessment,
  UrlDiscoverySource
} from "@seo-tool/domain-model";
import type { ParsedPage } from "./html-parse.js";
import type { CrawlScopeType } from "./url-normalization.js";

export interface CrawlSeedInput {
  projectId: string;
  siteId: string;
  baseUrl: string;
}

export interface SitemapDiscoveryInput extends CrawlSeedInput {
  sitemapXml: string;
  sitemapUrl: string;
  discoveredAt?: string;
}

export interface SitemapIndexDiscoveryInput extends SitemapDiscoveryInput {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retry?: FetchRetryPolicy;
  maxIndexDepth?: number;
  maxSitemapFetches?: number;
}

export interface FetchRetryPolicy {
  maxAttempts: number;
  /** Base delay (ms) for the first retry. Subsequent retries use capped exponential backoff. */
  delayMs?: number;
  /** Upper bound (ms) for any single backoff wait. Defaults to DEFAULT_RETRY_MAX_DELAY_MS. */
  maxDelayMs?: number;
  /** Injectable sleep so tests can assert the backoff sequence without real timers. */
  sleep?: (ms: number) => Promise<void>;
}

export interface FetchWorkerInput {
  url: string;
  fetchImpl?: typeof fetch;
  fetchedAt?: string;
  timeoutMs?: number;
  retry?: FetchRetryPolicy;
  maxRedirects?: number;
  /** User-Agent header to send and to use for robots.txt group selection. */
  userAgent?: string;
  /** Cap (bytes) on the response body read into memory. Default DEFAULT_MAX_BODY_BYTES. */
  maxBodyBytes?: number;
}

export interface AuditPageInput {
  url: string;
  finalUrl?: string;
  statusCode: number | null;
  headers?: Record<string, string>;
  html?: string;
  /** DOM parse of `html` (links/title/canonical/robots). Set once by the crawl
   *  cycle and reused by indexability + audit so a page is parsed only once. */
  parsed?: ParsedPage;
  outgoingLinks?: Array<{ url: string; statusCode: number | null }>;
}

export interface RobotsRule {
  userAgent: string;
  directive: "allow" | "disallow";
  path: string;
}

export interface RobotsPolicy {
  rules: RobotsRule[];
  fetchedUrl: string;
  /** Absolute Sitemap: URLs declared in robots.txt. */
  sitemaps?: string[];
  /** Crawl-delay (seconds) per user-agent token (lowercased). */
  crawlDelays?: Record<string, number>;
}

/** One same-site internal link edge to persist (matches the API's internal-links POST body items). */
export interface InternalLinkEdgeInput {
  fromUrl: string;
  toUrl: string;
  anchor?: string | null;
  rel?: string | null;
}

export interface CrawlWorkerApiClient {
  claimNextJob(): Promise<FoundationJob | null>;
  createCrawlRun(projectId: string, siteId: string, trigger: "manual" | "scheduled" | "deploy"): Promise<{ id: string }>;
  recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): Promise<DiscoveredUrl[]>;
  recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: FetchResult): Promise<FetchResult & { id: string }>;
  recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: IndexabilityAssessment & { fetchResultId: string | null; assessedAt: string }): Promise<unknown>;
  recordAuditIssues(projectId: string, siteId: string, issues: Array<AuditIssue & { projectId: string; siteId: string; discoveredUrlId: string | null; detectedAt: string; resolvedAt: string | null }>, checkedDiscoveredUrlIds: string[]): Promise<unknown>;
  computeHealthScore(projectId: string, siteId: string): Promise<unknown>;
  completeCrawlRun(projectId: string, siteId: string, crawlRunId: string, status: "succeeded" | "failed", errorMessage?: string): Promise<unknown>;
  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): Promise<FoundationJob>;
  // --- Resumable-crawl extensions. Optional: present on the HTTP + in-process
  //     clients; when absent (or without timeBudgetMs) the cycle runs the classic
  //     single-invocation in-memory path unchanged. ---
  enqueueCrawlFrontier?(projectId: string, siteId: string, crawlRunId: string, entries: Array<{ normalizedUrl: string; depth: number; discoveredFrom: string | null }>): Promise<{ enqueued: number; pending: number }>;
  claimCrawlFrontier?(projectId: string, siteId: string, crawlRunId: string, limit: number): Promise<{ items: CrawlFrontierEntry[]; pending: number }>;
  completeCrawlFrontier?(projectId: string, siteId: string, crawlRunId: string, normalizedUrls: string[]): Promise<{ done: number; pending: number }>;
  countPendingCrawlFrontier?(projectId: string, siteId: string, crawlRunId: string): Promise<number>;
  recordCrawlPageSignals?(projectId: string, siteId: string, crawlRunId: string, signals: Array<Omit<CrawlPageSignal, "crawlRunId">>): Promise<{ recorded: number }>;
  listCrawlPageSignals?(projectId: string, siteId: string, crawlRunId: string): Promise<CrawlPageSignal[]>;
  /** Persist same-site internal link edges for the link graph (GAP-LINK-001). Optional: absent on
   *  minimal/in-process clients, in which case the crawl cycle skips edge recording. */
  recordInternalLinks?(projectId: string, siteId: string, edges: InternalLinkEdgeInput[]): Promise<{ inserted: number; updated: number }>;
  /** Enqueue a continuation crawl_seed job (same crawlRunId, resume:true). */
  createCrawlSeedJob?(projectId: string, subject: string, payload: Record<string, unknown>): Promise<unknown>;
}

export interface CrawlWorkerCycleOptions {
  apiClient: CrawlWorkerApiClient;
  fetchImpl?: typeof fetch;
  now?: () => string;
  maxUrls?: number;
  /** BFS link-following depth limit (0 = seed/sitemap only). Default DEFAULT_MAX_DEPTH. */
  maxDepth?: number;
  /** Crawl scope strategy (from site.scope_type). Default "domain". */
  scopeType?: CrawlScopeType;
  fetchTimeoutMs?: number;
  retry?: FetchRetryPolicy;
  maxRedirects?: number;
  maxOutgoingLinkChecks?: number;
  maxSitemapIndexDepth?: number;
  maxSitemapFetches?: number;
  /** User-Agent header to send and to use for robots.txt group selection. */
  userAgent?: string;
  /** Cap (bytes) on each response body read into memory. Default DEFAULT_MAX_BODY_BYTES. */
  maxBodyBytes?: number;
  /** Trap guard: max URL length enqueued. Default DEFAULT_MAX_URL_LENGTH. */
  maxUrlLength?: number;
  /** Trap guard: max distinct query variants enqueued per path. Default DEFAULT_MAX_DISTINCT_QUERY_PER_PATH. */
  maxDistinctQueryPerPath?: number;
  /** Politeness cap (ms) on the per-host crawl-delay. Default DEFAULT_MAX_CRAWL_DELAY_MS. */
  maxCrawlDelayMs?: number;
  /** Injectable sleep for the per-host politeness wait (tests assert without real timers). */
  sleep?: (ms: number) => Promise<void>;
  /** Max page fetches in flight at once. Forced to 1 when a crawl-delay applies. Default DEFAULT_MAX_CONCURRENCY. */
  maxConcurrency?: number;
  /** When set (and the client supports the frontier), run the resumable path: process a
   *  time-bounded batch, persist the frontier, and enqueue a continuation job if work remains. */
  timeBudgetMs?: number;
  /** URLs claimed from the frontier per batch in the resumable path. Default DEFAULT_FRONTIER_BATCH. */
  frontierBatchSize?: number;
}

export interface CrawlWorkerCycleResult {
  claimed: boolean;
  jobId?: string;
  status?: FoundationJob["status"];
  crawlRunId?: string;
  discoveredUrls?: number;
  fetchedUrls?: number;
  issues?: number;
  /** Pages whose fetch/assess raised an error but did not abort the run (per-URL boundary). */
  pageErrors?: number;
  /** True when maxUrls/maxDepth capped the crawl before the frontier was exhausted. */
  truncated?: boolean;
  /** Wall-clock duration of the crawl_seed cycle in ms. */
  durationMs?: number;
  errorMessage?: string;
}

export type { AuditIssue, DiscoveredUrl, FetchResult, FoundationJob, IndexabilityAssessment, UrlDiscoverySource };
