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

export interface FetchWorkerInput {
  url: string;
  fetchImpl?: typeof fetch;
  fetchedAt?: string;
}

export interface AuditPageInput {
  url: string;
  finalUrl?: string;
  statusCode: number | null;
  headers?: Record<string, string>;
  html?: string;
  outgoingLinks?: Array<{ url: string; statusCode: number | null }>;
}

export function createCrawlSeedJob(input: CrawlSeedInput): FoundationJob {
  const now = new Date().toISOString();
  return {
    id: `job-crawl-seed-${input.siteId}`,
    projectId: input.projectId,
    type: "crawl_seed",
    status: "queued",
    idempotencyKey: makeIdempotencyKey(input.projectId, "crawl_seed", input.baseUrl),
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

  try {
    const response = await fetchImpl(input.url, { redirect: "manual" });
    const headers = normalizeHeaders(response.headers);
    const statusCode = response.status;
    const location = response.headers.get("location");
    const finalUrl = location ? normalizeCrawlUrl(location, input.url) : response.url || input.url;

    return {
      url: input.url,
      finalUrl,
      statusCode,
      statusClass: classifyStatus(statusCode),
      headers,
      redirectChain: statusCode >= 300 && statusCode < 400 && location ? [input.url, finalUrl] : [],
      fetchedAt
    };
  } catch (error) {
    return {
      url: input.url,
      finalUrl: input.url,
      statusCode: null,
      statusClass: "network_error",
      headers: {},
      redirectChain: [],
      fetchedAt,
      errorMessage: error instanceof Error ? error.message : "Unknown fetch error"
    };
  }
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
