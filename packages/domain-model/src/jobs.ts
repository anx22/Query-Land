import { DomainValidationError } from "./errors.js";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface FoundationJob {
  id: string;
  projectId: string;
  type: "connector_sync" | "crawl_seed" | "source_map_refresh" | "health_check";
  status: JobStatus;
  idempotencyKey: string;
  subject: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrawlSeedJobPayload {
  siteId: string;
  baseUrl: string;
  crawlRunId?: string;
  sitemapUrl?: string;
}

export interface ScheduledCrawlSeedJobPayload extends CrawlSeedJobPayload {
  crawlRunId: string;
}

export interface CrawlSeedJobInput {
  type: Extract<FoundationJob["type"], "crawl_seed">;
  subject: string;
  payload: CrawlSeedJobPayload;
}

export function makeIdempotencyKey(projectId: string, jobType: FoundationJob["type"], subject: string): string {
  return `${projectId}:${jobType}:${subject}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
}

export function createCrawlSeedJobInput(input: ScheduledCrawlSeedJobPayload): CrawlSeedJobInput {
  const payload = validateCrawlSeedJobPayload(input);
  if (!payload.crawlRunId) {
    throw new DomainValidationError("crawl_seed crawlRunId is required for scheduled job input");
  }
  return {
    type: "crawl_seed",
    subject: makeCrawlSeedJobSubject(payload.baseUrl, payload.crawlRunId),
    payload: { ...payload, crawlRunId: payload.crawlRunId }
  };
}

export function makeCrawlSeedJobSubject(baseUrl: string, crawlRunId: string): string {
  const normalizedBaseUrl = normalizeRequiredUrl(baseUrl, "baseUrl");
  const normalizedCrawlRunId = requiredString(crawlRunId, "crawlRunId");
  return `${normalizedBaseUrl}:run:${normalizedCrawlRunId}`;
}

export function validateCrawlSeedJobPayload(input: unknown): CrawlSeedJobPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DomainValidationError("crawl_seed payload must be an object");
  }
  const value = input as Record<string, unknown>;
  const payload: CrawlSeedJobPayload = {
    siteId: requiredString(value.siteId, "siteId"),
    baseUrl: normalizeRequiredUrl(value.baseUrl, "baseUrl")
  };
  if (value.crawlRunId !== undefined) {
    payload.crawlRunId = requiredString(value.crawlRunId, "crawlRunId");
  }
  if (value.sitemapUrl !== undefined) {
    payload.sitemapUrl = normalizeRequiredUrl(value.sitemapUrl, "sitemapUrl");
  }
  return payload;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainValidationError(`crawl_seed ${field} is required`);
  }
  return value.trim();
}

function normalizeRequiredUrl(value: unknown, field: string): string {
  const raw = requiredString(value, field);
  try {
    return new URL(raw).toString();
  } catch {
    throw new DomainValidationError(`crawl_seed ${field} must be a valid URL`);
  }
}
