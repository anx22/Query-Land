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
export * from "./audit-rules.js";
export * from "./crawl-cycle.js";
export * from "./fetch-url.js";
export * from "./indexability.js";
export * from "./link-extraction.js";
export * from "./robots.js";
export * from "./sitemap.js";
export * from "./types.js";
export * from "./url-normalization.js";
