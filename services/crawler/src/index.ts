import {
  calculateHealthScore,
  makeIdempotencyKey,
  type AuditIssue,
  type DiscoveredUrl,
  type FetchResult,
  type FoundationJob,
  type IndexabilityAssessment,
  type UrlDiscoverySource
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

export function normalizeCrawlUrl(rawUrl: string, baseUrl: string): string {
  const url = new URL(rawUrl.trim(), baseUrl);
  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function createDiscoveredUrl(input: CrawlSeedInput & { url: string; source: UrlDiscoverySource; discoveredFrom?: string | null; depth?: number; discoveredAt?: string }): DiscoveredUrl {
  const normalizedUrl = normalizeCrawlUrl(input.url, input.baseUrl);
  return {
    id: `url-${stableSlug(`${input.projectId}-${input.siteId}-${normalizedUrl}`)}`,
    projectId: input.projectId,
    siteId: input.siteId,
    url: input.url,
    normalizedUrl,
    source: input.source,
    discoveredFrom: input.discoveredFrom ?? null,
    depth: input.depth ?? 0,
    discoveredAt: input.discoveredAt ?? new Date().toISOString()
  };
}

export function discoverUrlsFromSitemap(input: SitemapDiscoveryInput): DiscoveredUrl[] {
  const locs = [...input.sitemapXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeXml(match[1] ?? ""));
  const uniqueUrls = [...new Set([input.baseUrl, ...locs])];
  return uniqueUrls.map((url, index) => createDiscoveredUrl({
    projectId: input.projectId,
    siteId: input.siteId,
    baseUrl: input.baseUrl,
    url,
    source: index === 0 ? "seed" : "sitemap",
    discoveredFrom: index === 0 ? null : input.sitemapUrl,
    depth: index === 0 ? 0 : 1,
    discoveredAt: input.discoveredAt
  }));
}

export async function fetchUrl(input: FetchWorkerInput): Promise<FetchResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const fetchedAt = input.fetchedAt ?? new Date().toISOString();
  const maxAttempts = Math.max(1, input.retry?.maxAttempts ?? 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = input.timeoutMs ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), input.timeoutMs) : null;

    try {
      const response = await fetchImpl(input.url, { redirect: "manual", signal: controller?.signal });
      if (timeout) clearTimeout(timeout);
      const headers = normalizeHeaders(response.headers);
      const statusCode = response.status;
      const location = response.headers.get("location");
      const finalUrl = location ? normalizeCrawlUrl(location, input.url) : response.url || input.url;
      const responseBody = await response.text().catch(() => "");

      return {
        url: input.url,
        finalUrl,
        statusCode,
        statusClass: classifyStatus(statusCode),
        headers,
        redirectChain: statusCode >= 300 && statusCode < 400 && location ? [input.url, finalUrl] : [],
        fetchedAt,
        responseBody
      };
    } catch (error) {
      if (timeout) clearTimeout(timeout);
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(input.retry?.delayMs ?? 0);
      }
    }
  }

  return {
    url: input.url,
    finalUrl: input.url,
    statusCode: null,
    statusClass: "network_error",
    headers: {},
    redirectChain: [],
    fetchedAt,
    errorMessage: networkErrorMessage(lastError, maxAttempts)
  };
}

export function assessIndexability(input: AuditPageInput): IndexabilityAssessment {
  const headers = lowercaseHeaders(input.headers ?? {});
  const canonicalUrl = extractCanonical(input.html ?? "");
  const robotsMeta = extractRobotsMeta(input.html ?? "");
  const xRobots = headers["x-robots-tag"] ?? "";
  const finalUrl = input.finalUrl ?? input.url;

  if (input.statusCode === null || input.statusCode >= 400 || input.statusCode < 200) {
    return assessment(input.url, "blocked_by_status", false, [`HTTP status ${input.statusCode ?? "network_error"}`], canonicalUrl);
  }

  if (/noindex/i.test(xRobots)) {
    return assessment(input.url, "blocked_by_x_robots", false, ["X-Robots-Tag contains noindex"], canonicalUrl);
  }

  if (/noindex/i.test(robotsMeta)) {
    return assessment(input.url, "blocked_by_meta", false, ["robots meta contains noindex"], canonicalUrl);
  }

  if (canonicalUrl && normalizeCrawlUrl(canonicalUrl, finalUrl) !== normalizeCrawlUrl(finalUrl, finalUrl)) {
    return assessment(input.url, "canonicalized", false, [`Canonical points to ${canonicalUrl}`], canonicalUrl);
  }

  return assessment(input.url, "indexable", true, [], canonicalUrl);
}

export function evaluateAuditIssues(pages: AuditPageInput[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const titleCounts = new Map<string, number>();

  for (const page of pages) {
    const title = extractTitle(page.html ?? "");
    if (title) {
      titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    }
  }

  for (const page of pages) {
    const title = extractTitle(page.html ?? "");
    const finalUrl = page.finalUrl ?? page.url;
    const canonicalUrl = extractCanonical(page.html ?? "");

    if (page.statusCode === null || page.statusCode >= 400) {
      issues.push(issue(page.url, "http_error", page.statusCode !== null && page.statusCode >= 500 ? "critical" : "high", `HTTP fetch returned ${page.statusCode ?? "network error"}.`));
    }

    if (page.statusCode !== null && page.statusCode >= 300 && page.statusCode < 400) {
      issues.push(issue(page.url, "redirect_chain", "medium", "URL returns a redirect response."));
    }

    if (!title) {
      issues.push(issue(page.url, "missing_title", "medium", "Page is missing a title element."));
    } else if ((titleCounts.get(title) ?? 0) > 1) {
      issues.push(issue(page.url, "duplicate_title", "low", `Title is duplicated: ${title}.`));
    }

    if (canonicalUrl && normalizeCrawlUrl(canonicalUrl, finalUrl) !== normalizeCrawlUrl(finalUrl, finalUrl)) {
      issues.push(issue(page.url, "canonical_mismatch", "medium", `Canonical does not match final URL: ${canonicalUrl}.`));
    }

    for (const link of page.outgoingLinks ?? []) {
      if (link.statusCode === null || link.statusCode >= 400) {
        issues.push(issue(page.url, "broken_link", "high", `Broken outgoing link: ${link.url}.`));
      }
    }
  }

  return issues;
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

    if (sitemapFetch.statusCode && sitemapFetch.statusCode >= 200 && sitemapFetch.statusCode < 300 && discovered.length <= 1) {
      throw new Error(`invalid sitemap: ${sitemapUrl}`);
    }

    const scopedDiscovered = filterInScopeUrls(discovered, baseUrl);
    const storedUrls = (await options.apiClient.recordDiscoveredUrls(job.projectId, siteId, scopedDiscovered)).slice(0, options.maxUrls ?? 25);
    const pages: AuditPageInput[] = [];
    const detectedAt = now();
    let fetchedUrls = 0;

    for (const discoveredUrl of storedUrls) {
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
    await options.apiClient.recordAuditIssues(job.projectId, siteId, issues);
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
