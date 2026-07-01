import { makeCrawlSeedJobSubject, validateCrawlSeedJobPayload, type DiscoveredUrl, type FetchResult } from "@seo-tool/domain-model";
import { DEFAULT_CRAWLER_USER_AGENT, DEFAULT_FRONTIER_BATCH, DEFAULT_MAX_CONCURRENCY, DEFAULT_MAX_CRAWL_DELAY_MS, DEFAULT_MAX_DEPTH, DEFAULT_MAX_DISTINCT_QUERY_PER_PATH, DEFAULT_MAX_URL_LENGTH, DEFAULT_MAX_URLS, DEFAULT_TIME_BUDGET_MS } from "./config.js";
import { assessIndexability } from "./indexability.js";
import { evaluateAuditIssues } from "./audit-rules.js";
import { fetchUrl } from "./fetch-url.js";
import { parsePage } from "./html-parse.js";
import { isRobotsAllowed, loadRobotsPolicy, robotsCrawlDelaySeconds } from "./robots.js";
import { createDiscoveredUrl, discoverUrlsFromSitemapIndex, extractSitemapLocations } from "./sitemap.js";
import type { AuditPageInput, CrawlWorkerCycleOptions, CrawlWorkerCycleResult, RobotsPolicy } from "./types.js";
import { hasRepeatedSegments, isInCrawlScope, normalizeCrawlUrl, type CrawlScopeType } from "./url-normalization.js";

const DEFAULT_MAX_OUTGOING_LINK_CHECKS = 50;

/** True when the client exposes the frontier + page-signal endpoints needed to resume. */
function supportsResumable(api: CrawlWorkerCycleOptions["apiClient"]): boolean {
  return Boolean(api.claimCrawlFrontier && api.enqueueCrawlFrontier && api.completeCrawlFrontier && api.countPendingCrawlFrontier && api.recordCrawlPageSignals && api.listCrawlPageSignals && api.createCrawlSeedJob);
}

export async function runCrawlWorkerCycle(options: CrawlWorkerCycleOptions): Promise<CrawlWorkerCycleResult> {
  // Resumable path is opt-in: only when a time budget is set AND the client can
  // persist/read the frontier. Otherwise the classic single-invocation in-memory
  // path below runs unchanged.
  if (options.timeBudgetMs != null && supportsResumable(options.apiClient)) {
    return runResumableCrawlWorkerCycle(options);
  }
  const cycleStartMs = Date.now();
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
    const seedFetch = await fetchUrl({ url: baseUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxRedirects: options.maxRedirects ?? 5, userAgent, maxBodyBytes: options.maxBodyBytes });
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

    // Additionally honour Sitemap: directives from robots.txt — best-effort and
    // lenient (a missing/garbage one is skipped, never fails the run). This is how
    // sites without /sitemap.xml still expose their sitemaps.
    const robotsSitemapDiscovered = await discoverFromRobotsSitemaps({ robotsPolicy, primarySitemapUrl: sitemapUrl, effectiveBase, scopeType, projectId: job.projectId, siteId, options, now });

    // --- Seed the frontier: seed URL (depth 0) + in-scope sitemap URLs (depth 0). ---
    const seedDiscovered = createDiscoveredUrl({ projectId: job.projectId, siteId, baseUrl: effectiveBase, url: effectiveBase, source: "seed", depth: 0, discoveredAt: now() });
    const initial = dedupeByNormalized([seedDiscovered, ...sitemapDiscovered, ...robotsSitemapDiscovered])
      .filter((url) => isInCrawlScope(url.normalizedUrl, effectiveBase, scopeType));

    const known = new Map<string, DiscoveredUrl>();
    const recordNew = async (urls: DiscoveredUrl[]): Promise<void> => {
      if (urls.length === 0) return;
      const all = await options.apiClient.recordDiscoveredUrls(job.projectId, siteId, urls);
      for (const url of all) known.set(url.normalizedUrl, url);
    };
    await recordNew(initial);

    const enqueued = new Set<string>(initial.map((u) => u.normalizedUrl));
    let frontier: Array<{ url: string; depth: number }> = initial.map((u) => ({ url: u.normalizedUrl, depth: u.depth ?? 0 }));

    const pages: AuditPageInput[] = [];
    const checkedDiscoveredUrlIds: string[] = [];
    let fetchedUrls = 0;
    let pageErrors = 0;
    let reserved = 0; // slots reserved for an actual fetch (fetched + errored); caps at maxUrls
    let truncated = false;

    // --- Politeness: honour robots Crawl-delay between same-host fetches (capped). ---
    const crawlDelayMs = Math.min((robotsCrawlDelaySeconds(robotsPolicy, userAgent) ?? 0) * 1000, options.maxCrawlDelayMs ?? DEFAULT_MAX_CRAWL_DELAY_MS);
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    // Seed/robots/sitemap already hit the base host, so it counts as "fetched"
    // — the first in-scope page fetch then honours the crawl-delay.
    const fetchedHosts = new Set<string>([safeHostOf(effectiveBase)]);
    // A crawl-delay forces serial fetching (per-host politeness); otherwise fan out.
    const concurrency = crawlDelayMs > 0 ? 1 : Math.max(1, options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY);
    // --- Trap guard: cap distinct query-string variants enqueued per path. ---
    const distinctQueryByPath = new Map<string, number>();

    // Process one frontier URL: fetch/assess/record and return the in-scope,
    // followable child links (deduped + guarded later, once per generation).
    const processOne = async (url: string, depth: number): Promise<Array<{ url: string; depth: number; from: string }>> => {
      const stored = known.get(url);
      if (!stored) return [];
      try {
        if (!isRobotsAllowed(url, robotsPolicy, userAgent)) {
          checkedDiscoveredUrlIds.push(stored.id);
          await options.apiClient.recordIndexabilityAssessment(job.projectId, siteId, stored.id, {
            url,
            state: "blocked_by_robots",
            isIndexable: false,
            reasons: [`robots.txt disallows ${new URL(url).pathname}`],
            canonicalUrl: null,
            fetchResultId: null,
            assessedAt: now()
          });
          return [];
        }

        // Reserve a fetch slot synchronously (no await between check and increment)
        // so bounded concurrency can never exceed maxUrls.
        if (reserved >= maxUrls) {
          truncated = true;
          return [];
        }
        reserved += 1;
        checkedDiscoveredUrlIds.push(stored.id);

        let fetchResult = fetchesByUrl.get(url);
        if (!fetchResult) {
          // Politeness: wait the crawl-delay before a repeat hit on the same host.
          if (crawlDelayMs > 0) {
            const host = new URL(url).host;
            if (fetchedHosts.has(host)) await sleep(crawlDelayMs);
            fetchedHosts.add(host);
          }
          fetchResult = await fetchUrl({ url, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxRedirects: options.maxRedirects ?? 5, userAgent, maxBodyBytes: options.maxBodyBytes });
        }
        fetchesByUrl.set(url, fetchResult);
        const storedFetch = await options.apiClient.recordFetchResult(job.projectId, siteId, stored.id, fetchResult);
        const html = fetchResult.responseBody ?? "";
        const page: AuditPageInput = {
          url,
          finalUrl: fetchResult.finalUrl,
          statusCode: fetchResult.statusCode,
          headers: fetchResult.headers,
          html,
          // Parse the DOM once here; indexability, audit rules and link-following
          // all reuse this result instead of re-parsing the same HTML.
          parsed: parsePage(html, fetchResult.finalUrl ?? url),
          outgoingLinks: []
        };
        pages.push(page);
        const assessment = assessIndexability(page);
        await options.apiClient.recordIndexabilityAssessment(job.projectId, siteId, stored.id, { ...assessment, fetchResultId: storedFetch.id, assessedAt: now() });
        fetchedUrls += 1;

        if (depth >= maxDepth) return [];
        return (page.parsed?.links ?? [])
          .filter((link) => !link.nofollow)
          .map((link) => link.url)
          .filter((link) => isInCrawlScope(link, effectiveBase, scopeType))
          .map((link) => ({ url: link, depth: depth + 1, from: url }));
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
        return [];
      }
    };

    // --- BFS over the frontier by generation, each generation fetched with
    //     bounded concurrency, bounded overall by maxUrls + maxDepth. ---
    while (frontier.length > 0 && reserved < maxUrls) {
      const childLists = await mapWithConcurrency(frontier, concurrency, (item) => processOne(item.url, item.depth));

      // Grow the frontier once per generation: dedupe + guard + persist in a
      // single batch (no concurrent writes / no races on `enqueued`).
      const next: Array<{ url: string; depth: number }> = [];
      const freshDiscovered: DiscoveredUrl[] = [];
      for (const children of childLists) {
        for (const child of children) {
          if (enqueued.has(child.url)) continue;
          if (!passesFrontierGuards(child.url, distinctQueryByPath, options)) continue;
          enqueued.add(child.url);
          freshDiscovered.push(createDiscoveredUrl({ projectId: job.projectId, siteId, baseUrl: effectiveBase, url: child.url, source: "link", depth: child.depth, discoveredFrom: child.from, discoveredAt: now() }));
          next.push({ url: child.url, depth: child.depth });
        }
      }
      if (freshDiscovered.length > 0) await recordNew(freshDiscovered);
      frontier = next;
    }
    if (frontier.length > 0) truncated = true;

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

    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, discoveredUrls: known.size, fetchedUrls, issues: issues.length, pageErrors, truncated, durationMs: Date.now() - cycleStartMs };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown crawl worker error";
    if (siteId && crawlRunId) {
      await options.apiClient.completeCrawlRun(job.projectId, siteId, crawlRunId, "failed", errorMessage).catch(() => undefined);
    }
    const completed = await options.apiClient.completeJob(job.id, "failed", errorMessage);
    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, errorMessage, durationMs: Date.now() - cycleStartMs };
  }
}

/**
 * Resumable crawl path (opt-in via timeBudgetMs). Processes a time-bounded batch
 * of the persisted crawl_frontier, records per-page audit signals, and either
 * enqueues a continuation job (work remains) or finalizes the run from the stored
 * signals (frontier drained). This lets a large site be crawled across several
 * serverless invocations while keeping the audit correct (see migrations 016/017).
 */
async function runResumableCrawlWorkerCycle(options: CrawlWorkerCycleOptions): Promise<CrawlWorkerCycleResult> {
  const cycleStartMs = Date.now();
  const api = options.apiClient;
  const job = await api.claimNextJob();
  if (!job) return { claimed: false };
  if (job.type !== "crawl_seed") {
    const completed = await api.completeJob(job.id, "succeeded");
    return { claimed: true, jobId: job.id, status: completed.status };
  }

  let siteId = "";
  let crawlRunId = "";
  try {
    const payload = validateCrawlSeedJobPayload(job.payload ?? {});
    const projectId = job.projectId;
    siteId = payload.siteId;
    const baseUrl = payload.baseUrl;
    const scopeType: CrawlScopeType = payload.scopeType ?? "domain";
    const maxUrls = options.maxUrls ?? DEFAULT_MAX_URLS;
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    const now = options.now ?? (() => new Date().toISOString());
    const userAgent = options.userAgent ?? DEFAULT_CRAWLER_USER_AGENT;
    const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
    const batchSize = Math.max(1, options.frontierBatchSize ?? DEFAULT_FRONTIER_BATCH);
    const fetchOpts = { fetchImpl: options.fetchImpl, timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxRedirects: options.maxRedirects ?? 5, userAgent, maxBodyBytes: options.maxBodyBytes } as const;

    crawlRunId = payload.crawlRunId ?? "";
    if (!crawlRunId) {
      const created = await api.createCrawlRun(projectId, siteId, "manual");
      if (!created?.id) throw new Error(`createCrawlRun returned no crawl run id for project ${projectId} / site ${siteId}`);
      crawlRunId = created.id;
    }

    // Effective base + robots resolved each invocation (needed for scope + robots + politeness).
    const seedFetch = await fetchUrl({ url: baseUrl, fetchedAt: now(), ...fetchOpts });
    const effectiveBase = seedFetch.finalUrl && /^https?:/i.test(seedFetch.finalUrl) ? seedFetch.finalUrl : baseUrl;
    const robotsPolicy = await loadRobotsPolicy({ baseUrl: effectiveBase, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, userAgent });
    const crawlDelayMs = Math.min((robotsCrawlDelaySeconds(robotsPolicy, userAgent) ?? 0) * 1000, options.maxCrawlDelayMs ?? DEFAULT_MAX_CRAWL_DELAY_MS);
    const concurrency = crawlDelayMs > 0 ? 1 : Math.max(1, options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY);

    const fetchesByUrl = new Map<string, FetchResult>();
    fetchesByUrl.set(normalizeCrawlUrl(effectiveBase, effectiveBase), seedFetch);
    // The discovered_url id is deterministic from (project, site, normalizedUrl);
    // source/depth don't affect it, so this resolves the id without a DB lookup.
    const discoveredIdFor = (normalizedUrl: string): string => createDiscoveredUrl({ projectId, siteId, baseUrl: effectiveBase, url: normalizedUrl, source: "link" }).id;

    // --- Bootstrap the frontier on the first invocation (skipped on resume). ---
    if (!payload.resume) {
      const sitemapUrl = payload.sitemapUrl ?? normalizeCrawlUrl("/sitemap.xml", effectiveBase);
      const sitemapFetch = await fetchUrl({ url: sitemapUrl, fetchedAt: now(), ...fetchOpts });
      const sitemapXml = sitemapFetch.responseBody ?? "";
      const sitemapOk = !!sitemapFetch.statusCode && sitemapFetch.statusCode >= 200 && sitemapFetch.statusCode < 300;
      const sitemapDiscovered = sitemapOk
        ? await discoverUrlsFromSitemapIndex({ projectId, siteId, baseUrl: effectiveBase, sitemapUrl, sitemapXml, discoveredAt: now(), fetchImpl: options.fetchImpl, timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxIndexDepth: options.maxSitemapIndexDepth, maxSitemapFetches: options.maxSitemapFetches })
        : [];
      if (sitemapOk && extractSitemapLocations(sitemapXml).length === 0) {
        throw new Error(`invalid sitemap: ${sitemapUrl}`);
      }
      const robotsSitemapDiscovered = await discoverFromRobotsSitemaps({ robotsPolicy, primarySitemapUrl: sitemapUrl, effectiveBase, scopeType, projectId, siteId, options, now });
      const seedDiscovered = createDiscoveredUrl({ projectId, siteId, baseUrl: effectiveBase, url: effectiveBase, source: "seed", depth: 0, discoveredAt: now() });
      const initial = dedupeByNormalized([seedDiscovered, ...sitemapDiscovered, ...robotsSitemapDiscovered]).filter((u) => isInCrawlScope(u.normalizedUrl, effectiveBase, scopeType));
      await api.recordDiscoveredUrls(projectId, siteId, initial);
      await api.enqueueCrawlFrontier!(projectId, siteId, crawlRunId, initial.map((u) => ({ normalizedUrl: u.normalizedUrl, depth: u.depth ?? 0, discoveredFrom: u.discoveredFrom ?? null })));
    }

    // --- Process time-bounded batches from the persisted frontier. ---
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const fetchedHosts = new Set<string>([safeHostOf(effectiveBase)]);
    const distinctQueryByPath = new Map<string, number>();
    const baselineProcessed = payload.resume ? (await api.listCrawlPageSignals!(projectId, siteId, crawlRunId)).length : 0;
    let fetchedThisRun = 0;
    let pageErrors = 0;
    let capReached = false;

    // Always process at least one batch per invocation (guarantees forward progress
    // even under a tiny budget), then stop once the wall-clock budget is spent.
    for (;;) {
      if (baselineProcessed + fetchedThisRun >= maxUrls) { capReached = true; break; }
      const { items } = await api.claimCrawlFrontier!(projectId, siteId, crawlRunId, batchSize);
      if (items.length === 0) break;

      await mapWithConcurrency(items, concurrency, async (item) => {
        const url = item.normalizedUrl;
        const depth = item.depth;
        const storedId = discoveredIdFor(url);
        try {
          if (!isRobotsAllowed(url, robotsPolicy, userAgent)) {
            await api.recordIndexabilityAssessment(projectId, siteId, storedId, { url, state: "blocked_by_robots", isIndexable: false, reasons: [`robots.txt disallows ${new URL(url).pathname}`], canonicalUrl: null, fetchResultId: null, assessedAt: now() });
            await api.completeCrawlFrontier!(projectId, siteId, crawlRunId, [url]);
            return;
          }
          let fetchResult = fetchesByUrl.get(url);
          if (!fetchResult) {
            if (crawlDelayMs > 0) {
              const host = new URL(url).host;
              if (fetchedHosts.has(host)) await sleep(crawlDelayMs);
              fetchedHosts.add(host);
            }
            fetchResult = await fetchUrl({ url, fetchedAt: now(), ...fetchOpts });
          }
          fetchesByUrl.set(url, fetchResult);
          const storedFetch = await api.recordFetchResult(projectId, siteId, storedId, fetchResult);
          const html = fetchResult.responseBody ?? "";
          const parsed = parsePage(html, fetchResult.finalUrl ?? url);
          const page: AuditPageInput = { url, finalUrl: fetchResult.finalUrl, statusCode: fetchResult.statusCode, headers: fetchResult.headers, html, parsed, outgoingLinks: [] };
          const assessment = assessIndexability(page);
          await api.recordIndexabilityAssessment(projectId, siteId, storedId, { ...assessment, fetchResultId: (storedFetch as { id: string }).id, assessedAt: now() });
          fetchedThisRun += 1;

          const inScopeLinks = parsed.links.map((l) => l.url).filter((l) => isInCrawlScope(l, effectiveBase, scopeType));
          await api.recordCrawlPageSignals!(projectId, siteId, crawlRunId, [{ normalizedUrl: url, finalUrl: fetchResult.finalUrl, statusCode: fetchResult.statusCode, title: parsed.title, canonicalUrl: parsed.canonicalUrl, outgoingLinks: inScopeLinks.map((l) => ({ url: l, statusCode: null })) }]);

          if (depth < maxDepth && baselineProcessed + fetchedThisRun < maxUrls) {
            const fresh = parsed.links.filter((l) => !l.nofollow).map((l) => l.url).filter((l) => isInCrawlScope(l, effectiveBase, scopeType)).filter((l) => passesFrontierGuards(l, distinctQueryByPath, options));
            if (fresh.length > 0) {
              await api.recordDiscoveredUrls(projectId, siteId, fresh.map((l) => createDiscoveredUrl({ projectId, siteId, baseUrl: effectiveBase, url: l, source: "link", depth: depth + 1, discoveredFrom: url, discoveredAt: now() })));
              await api.enqueueCrawlFrontier!(projectId, siteId, crawlRunId, fresh.map((l) => ({ normalizedUrl: l, depth: depth + 1, discoveredFrom: url })));
            }
          }
          await api.completeCrawlFrontier!(projectId, siteId, crawlRunId, [url]);
        } catch (pageError) {
          pageErrors += 1;
          const message = pageError instanceof Error ? pageError.message : "page processing failed";
          await api.recordIndexabilityAssessment(projectId, siteId, storedId, { url, state: "blocked_by_status", isIndexable: false, reasons: [`crawl error: ${message}`], canonicalUrl: null, fetchResultId: null, assessedAt: now() }).catch(() => undefined);
          await api.completeCrawlFrontier!(projectId, siteId, crawlRunId, [url]).catch(() => undefined);
        }
      });
      if (Date.now() - cycleStartMs >= timeBudgetMs) break;
    }

    const pending = await api.countPendingCrawlFrontier!(projectId, siteId, crawlRunId);

    // Work remains and we're under the cap → continuation job; leave the run running.
    if (pending > 0 && !capReached) {
      // Unique subject per continuation (progress cursor) so the job-queue
      // idempotency key does not collide with the original / earlier continuations.
      const continuationSubject = `${makeCrawlSeedJobSubject(baseUrl, crawlRunId)}:c${baselineProcessed + fetchedThisRun}`;
      await api.createCrawlSeedJob!(projectId, continuationSubject, { siteId, baseUrl, crawlRunId, sitemapUrl: payload.sitemapUrl, scopeType, resume: true });
      const completed = await api.completeJob(job.id, "succeeded");
      return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, fetchedUrls: fetchedThisRun, pageErrors, truncated: true, durationMs: Date.now() - cycleStartMs };
    }

    // Frontier drained (or cap reached) → finalize the audit from persisted signals.
    const signals = await api.listCrawlPageSignals!(projectId, siteId, crawlRunId);
    const statusByUrl = new Map<string, number | null>(signals.map((s) => [s.normalizedUrl, s.statusCode]));
    const pages: AuditPageInput[] = signals.map((s) => ({
      url: s.normalizedUrl,
      finalUrl: s.finalUrl,
      statusCode: s.statusCode,
      parsed: { title: s.title, canonicalUrl: s.canonicalUrl, robotsMeta: "", links: [] },
      // Only outgoing links we actually crawled carry a known status (broken-link check);
      // uncrawled/out-of-scope links are omitted rather than falsely flagged.
      outgoingLinks: s.outgoingLinks
        .map((l) => ({ url: l.url, normalized: normalizeCrawlUrl(l.url, effectiveBase) }))
        .filter((l) => statusByUrl.has(l.normalized))
        .map((l) => ({ url: l.url, statusCode: statusByUrl.get(l.normalized) ?? null }))
    }));
    const detectedAt = now();
    const issues = evaluateAuditIssues(pages).map((issue) => ({ ...issue, projectId, siteId, discoveredUrlId: discoveredIdFor(normalizeCrawlUrl(issue.url, effectiveBase)), detectedAt, resolvedAt: null }));
    await api.recordAuditIssues(projectId, siteId, issues, signals.map((s) => discoveredIdFor(s.normalizedUrl)));
    await api.computeHealthScore(projectId, siteId);
    await api.completeCrawlRun(projectId, siteId, crawlRunId, "succeeded");
    const completed = await api.completeJob(job.id, "succeeded");
    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, discoveredUrls: signals.length, fetchedUrls: signals.length, issues: issues.length, pageErrors, truncated: capReached, durationMs: Date.now() - cycleStartMs };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown crawl worker error";
    if (siteId && crawlRunId) {
      await options.apiClient.completeCrawlRun(job.projectId, siteId, crawlRunId, "failed", errorMessage).catch(() => undefined);
    }
    const completed = await options.apiClient.completeJob(job.id, "failed", errorMessage);
    return { claimed: true, jobId: job.id, status: completed.status, crawlRunId, errorMessage, durationMs: Date.now() - cycleStartMs };
  }
}

const MAX_ROBOTS_SITEMAPS = 5;

/** Discover page URLs from robots.txt `Sitemap:` directives (in-scope, bounded, lenient). */
async function discoverFromRobotsSitemaps(input: {
  robotsPolicy: RobotsPolicy;
  primarySitemapUrl: string;
  effectiveBase: string;
  scopeType: CrawlScopeType;
  projectId: string;
  siteId: string;
  options: CrawlWorkerCycleOptions;
  now: () => string;
}): Promise<DiscoveredUrl[]> {
  const { robotsPolicy, effectiveBase, scopeType, projectId, siteId, options, now } = input;
  const primary = normalizeCrawlUrl(input.primarySitemapUrl, effectiveBase);
  const candidates = [...new Set((robotsPolicy.sitemaps ?? []).map((url) => safeNormalize(url, effectiveBase)).filter((url): url is string => url !== null))]
    .filter((url) => url !== primary && isInCrawlScope(url, effectiveBase, scopeType))
    .slice(0, MAX_ROBOTS_SITEMAPS);

  const discovered: DiscoveredUrl[] = [];
  for (const sitemapUrl of candidates) {
    try {
      const fetchResult = await fetchUrl({ url: sitemapUrl, fetchImpl: options.fetchImpl, fetchedAt: now(), timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxRedirects: options.maxRedirects ?? 3, userAgent: options.userAgent ?? DEFAULT_CRAWLER_USER_AGENT, maxBodyBytes: options.maxBodyBytes });
      const ok = !!fetchResult.statusCode && fetchResult.statusCode >= 200 && fetchResult.statusCode < 300;
      const sitemapXml = fetchResult.responseBody ?? "";
      if (!ok || extractSitemapLocations(sitemapXml).length === 0) continue; // lenient: skip missing/garbage
      discovered.push(...(await discoverUrlsFromSitemapIndex({ projectId, siteId, baseUrl: effectiveBase, sitemapUrl, sitemapXml, discoveredAt: now(), fetchImpl: options.fetchImpl, timeoutMs: options.fetchTimeoutMs, retry: options.retry, maxIndexDepth: options.maxSitemapIndexDepth, maxSitemapFetches: options.maxSitemapFetches })));
    } catch {
      // Best-effort: a failing robots-declared sitemap must not fail the crawl.
    }
  }
  return discovered;
}

/**
 * Map `fn` over `items` with at most `limit` calls in flight, preserving result
 * order. Workers pull the next index synchronously, so the shared reservation
 * counter in `processOne` stays a correct concurrency gate.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  return results;
}

function safeHostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).host;
  } catch {
    return "";
  }
}

function safeNormalize(rawUrl: string, baseUrl: string): string | null {
  try {
    return normalizeCrawlUrl(rawUrl, baseUrl);
  } catch {
    return null;
  }
}

/**
 * Trap/limit guards applied before a link enters the frontier: reject
 * over-long URLs, spider-trap paths (repeated segments), and cap the number of
 * distinct query-string variants enqueued per path (faceted-nav explosions).
 * Mutates `distinctQueryByPath` as a side effect when it accepts a query URL.
 */
function passesFrontierGuards(link: string, distinctQueryByPath: Map<string, number>, options: CrawlWorkerCycleOptions): boolean {
  if (link.length > (options.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH)) return false;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  if (hasRepeatedSegments(url.pathname)) return false;
  if (url.search) {
    const cap = options.maxDistinctQueryPerPath ?? DEFAULT_MAX_DISTINCT_QUERY_PER_PATH;
    const key = `${url.origin}${url.pathname}`;
    const count = distinctQueryByPath.get(key) ?? 0;
    if (count >= cap) return false;
    distinctQueryByPath.set(key, count + 1);
  }
  return true;
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
    const parsed = page.parsed ?? parsePage(page.html ?? "", page.finalUrl ?? page.url);
    const links = parsed.links
      .map((link) => link.url)
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
    const result = await fetchUrl({ url: link, fetchImpl: input.options.fetchImpl, fetchedAt: input.now(), timeoutMs: input.options.fetchTimeoutMs, retry: input.options.retry, maxRedirects: input.options.maxRedirects ?? 5, userAgent: input.userAgent, maxBodyBytes: input.options.maxBodyBytes });
    input.fetchesByUrl.set(link, result);
  }

  for (const page of input.pages) {
    page.outgoingLinks = (page.outgoingLinks ?? [])
      .map((link) => ({ url: link.url, statusCode: input.fetchesByUrl.get(link.url)?.statusCode ?? link.statusCode }))
      .filter((link) => input.fetchesByUrl.has(link.url));
  }
}
