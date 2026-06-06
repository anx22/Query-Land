import { calculateHealthScore, makeIdempotencyKey, validateCrawlSeedJobPayload, type FoundationJob } from "@seo-tool/domain-model";
import type { CrawlSeedInput } from "./types.js";

export function createCrawlSeedJob(input: CrawlSeedInput): FoundationJob {
  const now = new Date().toISOString();
  const payload = validateCrawlSeedJobPayload({ baseUrl: input.baseUrl, siteId: input.siteId });
  return {
    id: `job-crawl-seed-${payload.siteId}`,
    projectId: input.projectId,
    type: "crawl_seed",
    status: "queued",
    idempotencyKey: makeIdempotencyKey(input.projectId, "crawl_seed", payload.baseUrl),
    subject: payload.baseUrl,
    payload: { ...payload, subject: payload.baseUrl },
    attempts: 0,
    createdAt: now,
    updatedAt: now
  };
}

export { calculateHealthScore };
export { evaluateAuditIssues } from "./audit-rules.js";
export { runCrawlWorkerCycle } from "./crawl-cycle.js";
export { fetchUrl } from "./fetch-url.js";
export { assessIndexability } from "./indexability.js";
export { extractOutgoingLinks } from "./link-extraction.js";
export { isRobotsAllowed, loadRobotsPolicy, parseRobotsTxt } from "./robots.js";
export { createDiscoveredUrl, discoverUrlsFromSitemap, discoverUrlsFromSitemapIndex, extractSitemapIndexLocations, extractSitemapLocations, extractUrlsetLocations } from "./sitemap.js";
export { isInCrawlScope, normalizeCrawlUrl } from "./url-normalization.js";
export type * from "./types.js";
