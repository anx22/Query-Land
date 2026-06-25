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

export function validateCrawlSeedJobPayload(input: unknown): CrawlSeedJobPayload {  if (!input || typeof input !== "object" || Array.isArray(input)) {
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

export interface ConnectorSyncJobPayload {
  integrationId: string;
  siteId?: string;
}

export function validateConnectorSyncJobPayload(input: unknown): ConnectorSyncJobPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DomainValidationError("connector_sync payload must be an object");
  }
  const value = input as Record<string, unknown>;
  const payload: ConnectorSyncJobPayload = {
    integrationId: connectorRequiredString(value.integrationId, "integrationId")
  };
  if (value.siteId !== undefined && value.siteId !== null) {
    payload.siteId = connectorRequiredString(value.siteId, "siteId");
  }
  return payload;
}

/**
 * Subject is idempotency-bearing: one connector sync per integration (+ optional
 * site) per day, so re-enqueuing on every cron tick collapses to a single job.
 */
export function makeConnectorSyncJobSubject(integrationId: string, dayIso: string, siteId?: string): string {
  const id = connectorRequiredString(integrationId, "integrationId");
  const day = connectorRequiredString(dayIso, "dayIso");
  return siteId ? `${id}:${day}:${siteId}` : `${id}:${day}`;
}

function connectorRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainValidationError(`connector_sync ${field} is required`);
  }
  return value.trim();
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
