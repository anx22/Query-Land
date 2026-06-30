import type {
  AuditIssue,
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
  errorMessage?: string;
}

export type { AuditIssue, DiscoveredUrl, FetchResult, FoundationJob, IndexabilityAssessment, UrlDiscoverySource };
