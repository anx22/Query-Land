import { validateCrawlSeedJobPayload, type DiscoveredUrl, type FetchResult } from "@seo-tool/domain-model";
import { DEFAULT_CRAWLER_USER_AGENT } from "./config.js";
import { assessIndexability } from "./indexability.js";
import { evaluateAuditIssues } from "./audit-rules.js";
import { fetchUrl } from "./fetch-url.js";
import { extractOutgoingLinks } from "./link-extraction.js";
import { isRobotsAllowed, loadRobotsPolicy } from "./robots.js";
import { createDiscoveredUrl, discoverUrlsFromSitemapIndex, extractSitemapLocations } from "./sitemap.js";
import type { AuditPageInput, CrawlWorkerCycleOptions, CrawlWorkerCycleResult, RobotsPolicy } from "./types.js";
import { isInCrawlScope, normalizeCrawlUrl } from "./url-normalization.js";

const DEFAULT_MAX_URLS = 25;
const DEFAULT_MAX_OUTGOING_LINK_CHECKS = 50;

export async function runCrawlWorkerCycle(options: CrawlWorkerCycleOptions): Promise<CrawlWorkerCycleResult> {
  const job = await options.apiClient.claimNextJob();
  if (!job) {
    return { claimed: false };
  }

  if (job.type !== "crawl_seed") {
    const completed = await options.apiClient.completeJob(job.id, "succeeded");
    return { claimed: true, jobId: job.id, status: completed.status };
  }

  let siteId = "";
  let baseUrl = "";
  let sitemapUrl = "";
  let crawlRunId = "";

  try {
    const payload = validateCrawlSeedJobPayload(job.payload ?? {});
    siteId = payload.siteId;
    baseUrl = payload.baseUrl;
    sitemapUrl = payload.sitemapUrl ?? normalizeCrawlUrl("/sitemap.xml", baseUrl);
    crawlRunId = payload.crawlRunId ?? "";
    if (!crawlRunId) {
      crawlRunId = (await options.apiClient.createCrawlRun(job.projectId, siteId, "manual")).id;
    }

    const now = options.now ?? (() => new Date().toISOString());
    const userAgent = options.userAgent ?? DEFAULT_CRAWLER_USER_AGENT;
    const robotsPolicy = await loadRobotsPolicy({ baseUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, userAgent });
    const sitemapFetch = await fetchUrl({ url: sitemapUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, userAgent });
    const sitemapXml = sitemapFetch.responseBody ?? "";
    const discovered = sitemapFetch.statusCode && sitemapFetch.statusCode >= 200 && sitemapFetch.statusCode < 300
      ? await discoverUrlsFromSitemapIndex({
        projectId: job.projectId,
        siteId,
        baseUrl,
        sitemapUrl,
        sitemapXml,
        discoveredAt: now(),
        fetchImpl: options.fetchImpl,
        timeoutMs: options.fetchTimeoutMs,
        retry: options.retry,
        maxIndexDepth: options.maxSitemapIndexDepth,
        maxSitemapFetches: options.maxSitemapFetches
      })
      : [createDiscoveredUrl({ projectId: job.projectId, siteId, baseUrl, url: baseUrl, source: "seed", depth: 0, discoveredAt: now() })];

    if (sitemapFetch.statusCode && sitemapFetch.statusCode >= 200 && sitemapFetch.statusCode < 300 && extractSitemapLocations(sitemapXml).length === 0) {
      throw new Error(`invalid sitemap: ${sitemapUrl}`);
    }

    const scopedDiscovered = filterInScopeUrls(discovered, baseUrl);
    const storedUrls = (await options.apiClient.recordDiscoveredUrls(job.projectId, siteId, scopedDiscovered)).slice(0, options.maxUrls ?? DEFAULT_MAX_URLS);
    const pages: AuditPageInput[] = [];
    const fetchesByUrl = new Map<string, FetchResult>();
    const detectedAt = now();
    let fetchedUrls = 0;
    const checkedDiscoveredUrlIds: string[] = [];

    for (const discoveredUrl of storedUrls) {
      checkedDiscoveredUrlIds.push(discoveredUrl.id);
      if (!isRobotsAllowed(discoveredUrl.normalizedUrl, robotsPolicy, userAgent)) {
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

      const fetchResult = await fetchUrl({ url: discoveredUrl.normalizedUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxRedirects: options.maxRedirects ?? 5, userAgent });
      fetchesByUrl.set(discoveredUrl.normalizedUrl, fetchResult);
      const storedFetch = await options.apiClient.recordFetchResult(job.projectId, siteId, discoveredUrl.id, fetchResult);
      const page: AuditPageInput = {
        url: discoveredUrl.normalizedUrl,
        finalUrl: fetchResult.finalUrl,
        statusCode: fetchResult.statusCode,
        headers: fetchResult.headers,
        html: fetchResult.responseBody ?? "",
        outgoingLinks: []
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

    await populateOutgoingLinkStatuses({ pages, baseUrl, robotsPolicy, fetchesByUrl, options, now, userAgent });

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

async function populateOutgoingLinkStatuses(input: {
  pages: AuditPageInput[];
  baseUrl: string;
  robotsPolicy: RobotsPolicy;
  fetchesByUrl: Map<string, FetchResult>;
  options: CrawlWorkerCycleOptions;
  now: () => string;
  userAgent: string;
}): Promise<void> {
  const remainingChecks = new Set<string>();
  const limit = Math.max(0, input.options.maxOutgoingLinkChecks ?? DEFAULT_MAX_OUTGOING_LINK_CHECKS);

  for (const page of input.pages) {
    const links = extractOutgoingLinks(page.html ?? "", page.finalUrl ?? page.url)
      .filter((link) => isInCrawlScope(link, input.baseUrl))
      .filter((link) => isRobotsAllowed(link, input.robotsPolicy, input.userAgent));

    page.outgoingLinks = links.map((link) => {
      const existingFetch = input.fetchesByUrl.get(link);
      if (!existingFetch && remainingChecks.size < limit) {
        remainingChecks.add(link);
      }
      return { url: link, statusCode: existingFetch?.statusCode ?? null };
    });
  }

  for (const link of remainingChecks) {
    if (input.fetchesByUrl.has(link)) continue;
    const result = await fetchUrl({ url: link, fetchImpl: input.options.fetchImpl, fetchedAt: input.now(), timeoutMs: input.options.fetchTimeoutMs, retry: input.options.retry, maxRedirects: input.options.maxRedirects ?? 5, userAgent: input.userAgent });
    input.fetchesByUrl.set(link, result);
  }

  for (const page of input.pages) {
    page.outgoingLinks = (page.outgoingLinks ?? [])
      .map((link) => ({ url: link.url, statusCode: input.fetchesByUrl.get(link.url)?.statusCode ?? link.statusCode }))
      .filter((link) => input.fetchesByUrl.has(link.url));
  }
}

function filterInScopeUrls(urls: DiscoveredUrl[], baseUrl: string): DiscoveredUrl[] {
  return urls.filter((url) => isInCrawlScope(url.normalizedUrl, baseUrl));
}

