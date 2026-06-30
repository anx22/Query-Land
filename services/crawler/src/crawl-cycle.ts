import { validateCrawlSeedJobPayload, type DiscoveredUrl, type FetchResult } from "@seo-tool/domain-model";
import { DEFAULT_CRAWLER_USER_AGENT, DEFAULT_MAX_DEPTH, DEFAULT_MAX_URLS } from "./config.js";
import { assessIndexability } from "./indexability.js";
import { evaluateAuditIssues } from "./audit-rules.js";
import { fetchUrl } from "./fetch-url.js";
import { extractOutgoingLinks } from "./link-extraction.js";
import { isRobotsAllowed, loadRobotsPolicy } from "./robots.js";
import { createDiscoveredUrl, discoverUrlsFromSitemapIndex, extractSitemapLocations } from "./sitemap.js";
import type { AuditPageInput, CrawlWorkerCycleOptions, CrawlWorkerCycleResult, RobotsPolicy } from "./types.js";
import { isInCrawlScope, normalizeCrawlUrl, type CrawlScopeType } from "./url-normalization.js";

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
  let crawlRunId = "";

  try {
    const payload = validateCrawlSeedJobPayload(job.payload ?? {});
    siteId = payload.siteId;
    baseUrl = payload.baseUrl;
    const scopeType: CrawlScopeType = payload.scopeType ?? "domain";
    const maxUrls = options.maxUrls ?? DEFAULT_MAX_URLS;
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    const now = options.now ?? (() => new Date().toISOString());
    const userAgent = options.userAgent ?? DEFAULT_CRAWLER_USER_AGENT;

    crawlRunId = payload.crawlRunId ?? "";
    if (!crawlRunId) {
      const createdRun = await options.apiClient.createCrawlRun(job.projectId, siteId, "manual");
      if (!createdRun?.id) {
        throw new Error(`createCrawlRun returned no crawl run id for project ${job.projectId} / site ${siteId}`);
      }
      crawlRunId = createdRun.id;
    }

    const fetchesByUrl = new Map<string, FetchResult>();

    // --- Resolve the effective base from the seed (follow non-www→www etc.) so
    // scope + link resolution use the site's real canonical host. ---
    const seedFetch = await fetchUrl({ url: baseUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxRedirects: options.maxRedirects ?? 5, userAgent });
    const effectiveBase = seedFetch.finalUrl && /^https?:/i.test(seedFetch.finalUrl) ? seedFetch.finalUrl : baseUrl;
    fetchesByUrl.set(normalizeCrawlUrl(effectiveBase, effectiveBase), seedFetch);

    // --- robots.txt + sitemap discovery, scoped to the effective base. ---
    const sitemapUrl = payload.sitemapUrl ?? normalizeCrawlUrl("/sitemap.xml", effectiveBase);
    const robotsPolicy = await loadRobotsPolicy({ baseUrl: effectiveBase, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, userAgent });
    const sitemapFetch = await fetchUrl({ url: sitemapUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, userAgent });
    const sitemapXml = sitemapFetch.responseBody ?? "";
    const sitemapOk = !!sitemapFetch.statusCode && sitemapFetch.statusCode >= 200 && sitemapFetch.statusCode < 300;
    const sitemapDiscovered = sitemapOk
      ? await discoverUrlsFromSitemapIndex({ projectId: job.projectId, siteId, baseUrl: effectiveBase, sitemapUrl, sitemapXml, discoveredAt: now(), fetchImpl: options.fetchImpl, timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxIndexDepth: options.maxSitemapIndexDepth, maxSitemapFetches: options.maxSitemapFetches })
      : [];
    if (sitemapOk && extractSitemapLocations(sitemapXml).length === 0) {
      throw new Error(`invalid sitemap: ${sitemapUrl}`);
    }

    // --- Seed the frontier: seed URL (depth 0) + in-scope sitemap URLs (depth 0). ---
    const seedDiscovered = createDiscoveredUrl({ projectId: job.projectId, siteId, baseUrl: effectiveBase, url: effectiveBase, source: "seed", depth: 0, discoveredAt: now() });
    const initial = dedupeByNormalized([seedDiscovered, ...sitemapDiscovered])
      .filter((url) => isInCrawlScope(url.normalizedUrl, effectiveBase, scopeType));

    const known = new Map<string, DiscoveredUrl>();
    const recordNew = async (urls: DiscoveredUrl[]): Promise<void> => {
      if (urls.length === 0) return;
      const all = await options.apiClient.recordDiscoveredUrls(job.projectId, siteId, urls);
      for (const url of all) known.set(url.normalizedUrl, url);
    };
    await recordNew(initial);

    const enqueued = new Set<string>(initial.map((u) => u.normalizedUrl));
    const queue: Array<{ url: string; depth: number }> = initial.map((u) => ({ url: u.normalizedUrl, depth: u.depth ?? 0 }));

    const pages: AuditPageInput[] = [];
    const checkedDiscoveredUrlIds: string[] = [];
    let fetchedUrls = 0;
    let pageErrors = 0;
    let truncated = false;

    // --- BFS over the frontier, bounded by maxUrls + maxDepth. ---
    while (queue.length > 0) {
      if (fetchedUrls + pageErrors >= maxUrls) {
        truncated = queue.length > 0;
        break;
      }
      const { url, depth } = queue.shift()!;
      const stored = known.get(url);
      if (!stored) continue;
      checkedDiscoveredUrlIds.push(stored.id);

      try {
        if (!isRobotsAllowed(url, robotsPolicy, userAgent)) {
          await options.apiClient.recordIndexabilityAssessment(job.projectId, siteId, stored.id, {
            url,
            state: "blocked_by_robots",
            isIndexable: false,
            reasons: [`robots.txt disallows ${new URL(url).pathname}`],
            canonicalUrl: null,
            fetchResultId: null,
            assessedAt: now()
          });
          continue;
        }

        const fetchResult = fetchesByUrl.get(url)
          ?? await fetchUrl({ url, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxRedirects: options.maxRedirects ?? 5, userAgent });
        fetchesByUrl.set(url, fetchResult);
        const storedFetch = await options.apiClient.recordFetchResult(job.projectId, siteId, stored.id, fetchResult);
        const page: AuditPageInput = {
          url,
          finalUrl: fetchResult.finalUrl,
          statusCode: fetchResult.statusCode,
          headers: fetchResult.headers,
          html: fetchResult.responseBody ?? "",
          outgoingLinks: []
        };
        pages.push(page);
        const assessment = assessIndexability(page);
        await options.apiClient.recordIndexabilityAssessment(job.projectId, siteId, stored.id, { ...assessment, fetchResultId: storedFetch.id, assessedAt: now() });
        fetchedUrls += 1;

        // --- Frontier growth: follow in-scope links one level deeper. ---
        if (depth < maxDepth) {
          const links = extractOutgoingLinks(page.html ?? "", page.finalUrl ?? url)
            .filter((link) => isInCrawlScope(link, effectiveBase, scopeType));
          const fresh = links.filter((link) => !enqueued.has(link));
          if (fresh.length > 0) {
            const discovered = fresh.map((link) => createDiscoveredUrl({ projectId: job.projectId, siteId, baseUrl: effectiveBase, url: link, source: "link", depth: depth + 1, discoveredFrom: url, discoveredAt: now() }));
            await recordNew(discovered);
            for (const link of fresh) {
              enqueued.add(link);
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (pageError) {
        // Per-URL error boundary: one bad page must not abort the whole run.
        pageErrors += 1;
        const message = pageError instanceof Error ? pageError.message : "page processing failed";
        await options.apiClient.recordIndexabilityAssessment(job.projectId, siteId, stored.id, {
          url,
          state: "blocked_by_status",
          isIndexable: false,
          reasons: [`crawl error: ${message}`],
          canonicalUrl: null,
          fetchResultId: null,
          assessedAt: now()
        }).catch(() => undefined);
      }
    }

    // Broken-link statuses for the audit rules (reuses BFS fetches; checks a bounded extra set).
    await populateOutgoingLinkStatuses({ pages, baseUrl: effectiveBase, scopeType, robotsPolicy, fetchesByUrl, options, now, userAgent });

    const discoveredByUrl = new Map([...known.values()].map((url) => [url.normalizedUrl, url]));
    const detectedAt = now();
    const issues = evaluateAuditIssues(pages).map((auditIssue) => ({
      ...auditIssue,
      projectId: job.projectId,
      siteId,
      discoveredUrlId: discoveredByUrl.get(normalizeCrawlUrl(auditIssue.url, effectiveBase))?.id ?? null,
      detectedAt,
      resolvedAt: null
    }));
    await options.apiClient.recordAuditIssues(job.projectId, siteId, issues, checkedDiscoveredUrlIds);
    await options.apiClient.computeHealthScore(job.projectId, siteId);
    await options.apiClient.completeCrawlRun(job.projectId, siteId, crawlRunId, "succeeded");
    const completed = await options.apiClient.completeJob(job.id, "succeeded");

    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, discoveredUrls: known.size, fetchedUrls, issues: issues.length, pageErrors, truncated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown crawl worker error";
    if (siteId && crawlRunId) {
      await options.apiClient.completeCrawlRun(job.projectId, siteId, crawlRunId, "failed", errorMessage).catch(() => undefined);
    }
    const completed = await options.apiClient.completeJob(job.id, "failed", errorMessage);
    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, errorMessage };
  }
}

function dedupeByNormalized(urls: DiscoveredUrl[]): DiscoveredUrl[] {
  const seen = new Set<string>();
  const out: DiscoveredUrl[] = [];
  for (const url of urls) {
    if (seen.has(url.normalizedUrl)) continue;
    seen.add(url.normalizedUrl);
    out.push(url);
  }
  return out;
}

async function populateOutgoingLinkStatuses(input: {
  pages: AuditPageInput[];
  baseUrl: string;
  scopeType: CrawlScopeType;
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
      .filter((link) => isInCrawlScope(link, input.baseUrl, input.scopeType))
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
