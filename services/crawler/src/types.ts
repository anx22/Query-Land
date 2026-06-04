import type {
  AuditIssue,
  DiscoveredUrl,
  FetchResult,
  FoundationJob,
  IndexabilityAssessment,
  UrlDiscoverySource
} from "@seo-tool/domain-model";

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

export interface FetchRetryPolicy {
  maxAttempts: number;
  delayMs?: number;
}

export interface FetchWorkerInput {
  url: string;
  fetchImpl?: typeof fetch;
  fetchedAt?: string;
  timeoutMs?: number;
  retry?: FetchRetryPolicy;
}

export interface AuditPageInput {
  url: string;
  finalUrl?: string;
  statusCode: number | null;
  headers?: Record<string, string>;
  html?: string;
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
  recordAuditIssues(projectId: string, siteId: string, issues: Array<AuditIssue & { projectId: string; siteId: string; discoveredUrlId: string | null; detectedAt: string; resolvedAt: string | null }>): Promise<unknown>;
  computeHealthScore(projectId: string, siteId: string): Promise<unknown>;
  completeCrawlRun(projectId: string, siteId: string, crawlRunId: string, status: "succeeded" | "failed", errorMessage?: string): Promise<unknown>;
  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): Promise<FoundationJob>;
}

export interface CrawlWorkerCycleOptions {
  apiClient: CrawlWorkerApiClient;
  fetchImpl?: typeof fetch;
  now?: () => string;
  maxUrls?: number;
  fetchTimeoutMs?: number;
  retry?: FetchRetryPolicy;
  maxOutgoingLinkChecks?: number;
}

export interface CrawlWorkerCycleResult {
  claimed: boolean;
  jobId?: string;
  status?: FoundationJob["status"];
  crawlRunId?: string;
  discoveredUrls?: number;
  fetchedUrls?: number;
  issues?: number;
  errorMessage?: string;
}

export type { AuditIssue, DiscoveredUrl, FetchResult, FoundationJob, IndexabilityAssessment, UrlDiscoverySource };
