import { makeIdempotencyKey, calculateHealthScore, type FoundationJob } from "@seo-tool/domain-model";
import type { CrawlSeedInput } from "./types.js";

export function createCrawlSeedJob(input: CrawlSeedInput): FoundationJob {
  const now = new Date().toISOString();
  return {
    id: `job-crawl-seed-${input.siteId}`,
    projectId: input.projectId,
    type: "crawl_seed",
    status: "queued",
    idempotencyKey: makeIdempotencyKey(input.projectId, "crawl_seed", input.baseUrl),
    subject: input.baseUrl,
    payload: { baseUrl: input.baseUrl, siteId: input.siteId, subject: input.baseUrl },
    attempts: 0,
    createdAt: now,
    updatedAt: now
  };
}

export { calculateHealthScore };

function classifyStatus(statusCode: number): FetchResult["statusClass"] {
  if (statusCode >= 200 && statusCode < 300) return "success";
  if (statusCode >= 300 && statusCode < 400) return "redirect";
  if (statusCode >= 400 && statusCode < 500) return "client_error";
  return "server_error";
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function lowercaseHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function assessment(url: string, state: IndexabilityAssessment["state"], isIndexable: boolean, reasons: string[], canonicalUrl: string | null): IndexabilityAssessment {
  return { url, state, isIndexable, reasons, canonicalUrl };
}

function issue(url: string, rule: AuditIssue["rule"], severity: AuditIssue["severity"], message: string): AuditIssue {
  return { id: `issue-${stableSlug(`${url}-${rule}-${message}`)}`, url, rule, severity, message };
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = match?.[1]?.trim();
  return title ? decodeXml(title) : null;
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match?.[1]?.trim() ?? null;
}

function extractRobotsMeta(html: string): string {
  const match = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']robots["'][^>]*>/i);
  return match?.[1] ?? "";
}

function extractSitemapLocations(sitemapXml: string): string[] {
  return [...sitemapXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeXml(match[1] ?? ""));
}

function decodeXml(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function stableSlug(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
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
  fetchTimeoutMs?: number;
  retry?: FetchRetryPolicy;
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

export async function runCrawlWorkerCycle(options: CrawlWorkerCycleOptions): Promise<CrawlWorkerCycleResult> {
  const job = await options.apiClient.claimNextJob();
  if (!job) {
    return { claimed: false };
  }

  if (job.type !== "crawl_seed") {
    const completed = await options.apiClient.completeJob(job.id, "succeeded");
    return { claimed: true, jobId: job.id, status: completed.status };
  }

  const payload = job.payload ?? {};
  const siteId = stringPayload(payload, "siteId");
  const baseUrl = stringPayload(payload, "baseUrl") || job.subject;
  const sitemapUrl = stringPayload(payload, "sitemapUrl") || normalizeCrawlUrl("/sitemap.xml", baseUrl);
  let crawlRunId = stringPayload(payload, "crawlRunId");

  try {
    if (!siteId || !baseUrl) {
      throw new Error("crawl_seed job payload requires siteId and baseUrl");
    }
    if (!crawlRunId) {
      crawlRunId = (await options.apiClient.createCrawlRun(job.projectId, siteId, "manual")).id;
    }

    const now = options.now ?? (() => new Date().toISOString());
    const robotsPolicy = await loadRobotsPolicy({ baseUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry });
    const sitemapFetch = await fetchUrl({ url: sitemapUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry });
    const sitemapXml = sitemapFetch.responseBody ?? "";
    const discovered = sitemapFetch.statusCode && sitemapFetch.statusCode >= 200 && sitemapFetch.statusCode < 300
      ? discoverUrlsFromSitemap({ projectId: job.projectId, siteId, baseUrl, sitemapUrl, sitemapXml, discoveredAt: now() })
      : [createDiscoveredUrl({ projectId: job.projectId, siteId, baseUrl, url: baseUrl, source: "seed", depth: 0, discoveredAt: now() })];

    if (sitemapFetch.statusCode && sitemapFetch.statusCode >= 200 && sitemapFetch.statusCode < 300 && extractSitemapLocations(sitemapXml).length === 0) {
      throw new Error(`invalid sitemap: ${sitemapUrl}`);
    }

    const scopedDiscovered = filterInScopeUrls(discovered, baseUrl);
    const storedUrls = (await options.apiClient.recordDiscoveredUrls(job.projectId, siteId, scopedDiscovered)).slice(0, options.maxUrls ?? 25);
    const pages: AuditPageInput[] = [];
    const checkedDiscoveredUrlIds: string[] = [];
    const detectedAt = now();
    let fetchedUrls = 0;

    for (const discoveredUrl of storedUrls) {
      checkedDiscoveredUrlIds.push(discoveredUrl.id);
      if (!isRobotsAllowed(discoveredUrl.normalizedUrl, robotsPolicy)) {
        await options.apiClient.recordIndexabilityAssessment(job.projectId, siteId, discoveredUrl.id, {
          url: discoveredUrl.normalizedUrl,
          state: "blocked_by_robots",
          isIndexable: false,
          reasons: [`robots.txt disallows ${new URL(discoveredUrl.normalizedUrl).pathname}`],
          canonicalUrl: null,
          fetchResultId: null,
          assessedAt: now()
        });
        continue;
      }

      const fetchResult = await fetchUrl({ url: discoveredUrl.normalizedUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry });
      const storedFetch = await options.apiClient.recordFetchResult(job.projectId, siteId, discoveredUrl.id, fetchResult);
      const page: AuditPageInput = {
        url: discoveredUrl.normalizedUrl,
        finalUrl: fetchResult.finalUrl,
        statusCode: fetchResult.statusCode,
        headers: fetchResult.headers,
        html: fetchResult.responseBody ?? ""
      };
      pages.push(page);
      const assessment = assessIndexability(page);
      await options.apiClient.recordIndexabilityAssessment(job.projectId, siteId, discoveredUrl.id, {
        ...assessment,
        fetchResultId: storedFetch.id,
        assessedAt: now()
      });
      fetchedUrls += 1;
    }

    const discoveredByUrl = new Map(storedUrls.map((url) => [url.normalizedUrl, url]));
    const issues = evaluateAuditIssues(pages).map((auditIssue) => ({
      ...auditIssue,
      projectId: job.projectId,
      siteId,
      discoveredUrlId: discoveredByUrl.get(normalizeCrawlUrl(auditIssue.url, baseUrl))?.id ?? null,
      detectedAt,
      resolvedAt: null
    }));
    await options.apiClient.recordAuditIssues(job.projectId, siteId, issues, checkedDiscoveredUrlIds);
    await options.apiClient.computeHealthScore(job.projectId, siteId);
    await options.apiClient.completeCrawlRun(job.projectId, siteId, crawlRunId, "succeeded");
    const completed = await options.apiClient.completeJob(job.id, "succeeded");

    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, discoveredUrls: storedUrls.length, fetchedUrls, issues: issues.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown crawl worker error";
    if (siteId && crawlRunId) {
      await options.apiClient.completeCrawlRun(job.projectId, siteId, crawlRunId, "failed", errorMessage).catch(() => undefined);
    }
    const completed = await options.apiClient.completeJob(job.id, "failed", errorMessage);
    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, errorMessage };
  }
}

function stringPayload(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}



export async function loadRobotsPolicy(input: Omit<FetchWorkerInput, "url"> & { baseUrl: string }): Promise<RobotsPolicy> {
  const robotsUrl = normalizeCrawlUrl("/robots.txt", input.baseUrl);
  const result = await fetchUrl({
    url: robotsUrl,
    fetchImpl: input.fetchImpl,
    fetchedAt: input.fetchedAt,
    timeoutMs: input.timeoutMs,
    retry: input.retry
  });

  return {
    fetchedUrl: robotsUrl,
    rules: result.statusCode && result.statusCode >= 200 && result.statusCode < 300
      ? parseRobotsTxt(result.responseBody ?? "")
      : []
  };
}

export function parseRobotsTxt(robotsTxt: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let activeUserAgents: string[] = [];
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawDirective, ...rawValue] = line.split(":");
    const directive = rawDirective?.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!directive) continue;

    if (directive === "user-agent") {
      activeUserAgents = [value.toLowerCase() || "*"];
      continue;
    }

    if ((directive === "allow" || directive === "disallow") && activeUserAgents.length > 0) {
      for (const userAgent of activeUserAgents) {
        rules.push({ userAgent, directive, path: value });
      }
    }
  }
  return rules;
}

export function isRobotsAllowed(candidateUrl: string, policy: RobotsPolicy, userAgent = "*"): boolean {
  const path = pathForRobots(candidateUrl);
  const matchingRules = policy.rules
    .filter((rule) => (rule.userAgent === "*" || rule.userAgent === userAgent.toLowerCase()) && rule.path !== "" && path.startsWith(rule.path))
    .sort((left, right) => right.path.length - left.path.length);
  const strongestRule = matchingRules[0];
  return strongestRule ? strongestRule.directive === "allow" : true;
}

function pathForRobots(candidateUrl: string): string {
  const url = new URL(candidateUrl);
  return `${url.pathname}${url.search}` || "/";
}

export function isInCrawlScope(candidateUrl: string, baseUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const base = new URL(baseUrl);
    return candidate.protocol === base.protocol && candidate.hostname === base.hostname;
  } catch {
    return false;
  }
}

function filterInScopeUrls(urls: DiscoveredUrl[], baseUrl: string): DiscoveredUrl[] {
  return urls.filter((url) => isInCrawlScope(url.normalizedUrl, baseUrl));
}

function networkErrorMessage(error: unknown, attempts: number): string {
  const message = error instanceof Error ? error.message : "Unknown fetch error";
  return attempts > 1 ? `${message} after ${attempts} attempts` : message;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
