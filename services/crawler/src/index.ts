import { makeIdempotencyKey, type FoundationJob } from "@seo-tool/domain-model";

export interface CrawlSeedInput {
  projectId: string;
  siteId: string;
  baseUrl: string;
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
