import type { AuditIssueRecord, AuditIssueSeverity, CrawlRun, CrawlRunStatus, DiscoveredUrl, FetchStatusClass, FoundationJob, IndexabilityRecord, IndexabilityState, IntegrationProvider, ProjectStatus, SiteScopeType, UrlDiscoverySource, UrlFetchRecord } from "@seo-tool/domain-model";
import { RequestError } from "./stores/store-errors.js";

type MarketInput = { country: string; language: string; device: "desktop" | "mobile"; searchEngine: "google" | "bing" };
type CreateProjectRequest = { name: string; slug: string; status?: ProjectStatus; defaultLocale?: string; markets?: MarketInput[] };
type CreateSiteRequest = { baseUrl: string; scopeType: SiteScopeType; crawlFrequency?: "manual" | "daily" | "weekly"; businessValue?: number };
type CreateCrawlRunRequest = { trigger: CrawlRun["trigger"] };
type ScheduleCrawlSeedRequest = { trigger: CrawlRun["trigger"]; baseUrl: string; sitemapUrl?: string };
type CompleteCrawlRunRequest = { status: Extract<CrawlRunStatus, "succeeded" | "failed">; errorMessage?: string };
type RecordDiscoveredUrlsRequest = { urls: DiscoveredUrl[] };
type RecordFetchResultRequest = Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">;
type RecordIndexabilityRequest = Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">;
type RecordAuditIssuesRequest = { issues: AuditIssueRecord[]; checkedDiscoveredUrlIds: string[] };
type CreateIntegrationRequest = { projectId: string; provider: IntegrationProvider };
type UpsertIntegrationCredentialsRequest = { projectId: string; provider: IntegrationProvider; property: string; accessToken: string; refreshToken: string; expiresAt: string };
type CreateJobRequest = { projectId: string; type: FoundationJob["type"]; subject: string; payload?: Record<string, unknown> };
type AuthRequest = { email: string; password: string; name?: string };

const projectStatuses = new Set<ProjectStatus>(["draft", "active", "archived"]);
const siteScopeTypes = new Set<SiteScopeType>(["domain", "subdomain", "folder"]);
const crawlFrequencies = new Set<Exclude<CreateSiteRequest["crawlFrequency"], undefined>>(["manual", "daily", "weekly"]);
const urlDiscoverySources = new Set<UrlDiscoverySource>(["seed", "sitemap", "link"]);
const fetchStatusClasses = new Set<FetchStatusClass>(["success", "redirect", "client_error", "server_error", "network_error"]);
const indexabilityStates = new Set<IndexabilityState>(["indexable", "blocked_by_status", "blocked_by_meta", "blocked_by_x_robots", "blocked_by_robots", "canonicalized"]);
const auditIssueSeverities = new Set<AuditIssueSeverity>(["critical", "high", "medium", "low"]);
const auditIssueRules = new Set<AuditIssueRecord["rule"]>(["http_error", "redirect_chain", "missing_title", "duplicate_title", "canonical_mismatch", "broken_link"]);
const crawlRunTriggers = new Set<CrawlRun["trigger"]>(["manual", "scheduled", "deploy"]);
const crawlRunCompletionStatuses = new Set<CompleteCrawlRunRequest["status"]>(["succeeded", "failed"]);
const integrationProviders = new Set<IntegrationProvider>(["gsc", "ga4", "matomo", "pagespeed", "lighthouse", "serverlogs", "sitemap", "robots", "crawler", "cms", "serp", "backlink", "keyword"]);
const jobTypes = new Set<FoundationJob["type"]>(["connector_sync", "crawl_seed", "source_map_refresh", "health_check"]);

export function authRequest(body: unknown, allowName: boolean): AuthRequest {
  const input = objectBody(body);
  const email = stringField(input, "email");
  const password = stringField(input, "password");
  const name = allowName && typeof input.name === "string" ? input.name : undefined;
  return { email, password, name };
}

export function createProjectRequest(body: unknown): CreateProjectRequest {
  const input = objectBody(body);
  const status = optionalEnum(input.status, projectStatuses, "status");
  return {
    name: stringField(input, "name"),
    slug: slugField(input, "slug"),
    status,
    defaultLocale: typeof input.defaultLocale === "string" ? input.defaultLocale : undefined,
    markets: Array.isArray(input.markets) ? input.markets as MarketInput[] : undefined
  };
}

export function createSiteRequest(body: unknown): CreateSiteRequest {
  const input = objectBody(body);
  const baseUrl = stringField(input, "baseUrl");
  try {
    new URL(baseUrl);
  } catch {
    throw new RequestError(400, "invalid_url", "baseUrl must be a valid URL");
  }
  return {
    baseUrl,
    scopeType: enumField(input, siteScopeTypes, "scopeType"),
    crawlFrequency: optionalEnum(input.crawlFrequency, crawlFrequencies, "crawlFrequency") as CreateSiteRequest["crawlFrequency"],
    businessValue: typeof input.businessValue === "number" ? input.businessValue : undefined
  };
}

export function createCrawlRunRequest(body: unknown): CreateCrawlRunRequest {
  const input = objectBody(body);
  return { trigger: enumField(input, crawlRunTriggers, "trigger") };
}

export function scheduleCrawlSeedRequest(body: unknown): ScheduleCrawlSeedRequest {
  const input = objectBody(body);
  return {
    trigger: input.trigger === undefined ? "manual" : enumField(input, crawlRunTriggers, "trigger"),
    baseUrl: urlField(input, "baseUrl"),
    sitemapUrl: input.sitemapUrl === undefined ? undefined : urlField(input, "sitemapUrl")
  };
}

export function completeCrawlRunRequest(body: unknown): CompleteCrawlRunRequest {
  const input = objectBody(body);
  return {
    status: enumField(input, crawlRunCompletionStatuses, "status"),
    errorMessage: input.errorMessage === undefined ? undefined : stringField(input, "errorMessage")
  };
}

export function enqueueCrawlFrontierRequest(body: unknown): { entries: Array<{ normalizedUrl: string; depth: number; discoveredFrom: string | null }> } {
  const input = objectBody(body);
  if (!Array.isArray(input.entries)) {
    throw new RequestError(400, "missing_field", "entries is required", { field: "entries" });
  }
  return {
    entries: input.entries.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new RequestError(400, "invalid_frontier_entry", "Each frontier entry must be an object", { index });
      }
      const entry = item as Record<string, unknown>;
      return {
        normalizedUrl: urlField(entry, "normalizedUrl"),
        depth: integerField(entry, "depth", 0),
        discoveredFrom: entry.discoveredFrom === null || entry.discoveredFrom === undefined ? null : urlField(entry, "discoveredFrom")
      };
    })
  };
}

export function claimCrawlFrontierRequest(body: unknown): { limit: number } {
  return { limit: integerField(objectBody(body), "limit", 1) };
}

export function completeCrawlFrontierRequest(body: unknown): { normalizedUrls: string[] } {
  const input = objectBody(body);
  if (!Array.isArray(input.normalizedUrls)) {
    throw new RequestError(400, "missing_field", "normalizedUrls is required", { field: "normalizedUrls" });
  }
  return {
    normalizedUrls: input.normalizedUrls.map((value, index) => {
      if (typeof value !== "string" || value.trim() === "") {
        throw new RequestError(400, "invalid_normalized_url", "Each normalizedUrl must be a non-empty string", { index });
      }
      return value;
    })
  };
}

export function recordAuditIssuesRequest(body: unknown): RecordAuditIssuesRequest {
  const input = objectBody(body);
  if (!Array.isArray(input.issues)) {
    throw new RequestError(400, "missing_field", "issues is required", { field: "issues" });
  }
  return {
    issues: input.issues.map((item, index) => auditIssueField(item, index)),
    checkedDiscoveredUrlIds: input.checkedDiscoveredUrlIds === undefined ? [] : stringArrayField(input, "checkedDiscoveredUrlIds")
  };
}

function auditIssueField(value: unknown, index: number): AuditIssueRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "invalid_audit_issue", "Each audit issue must be an object", { index });
  }
  const input = value as Record<string, unknown>;
  return {
    id: stringField(input, "id"),
    projectId: stringField(input, "projectId"),
    siteId: stringField(input, "siteId"),
    discoveredUrlId: input.discoveredUrlId === null || input.discoveredUrlId === undefined ? null : stringField(input, "discoveredUrlId"),
    url: urlField(input, "url"),
    rule: enumField(input, auditIssueRules, "rule"),
    severity: enumField(input, auditIssueSeverities, "severity"),
    message: stringField(input, "message"),
    detectedAt: stringField(input, "detectedAt"),
    resolvedAt: input.resolvedAt === null || input.resolvedAt === undefined ? null : stringField(input, "resolvedAt"),
    dismissedAt: input.dismissedAt === null || input.dismissedAt === undefined ? null : stringField(input, "dismissedAt"),
    dismissReason: input.dismissReason === null || input.dismissReason === undefined ? null : stringField(input, "dismissReason"),
    lastActor: input.lastActor === null || input.lastActor === undefined ? null : stringField(input, "lastActor")
  };
}

/**
 * Parse the optional dismiss reason from a dismiss-issue request body.
 * Accepts an absent body / absent field (→ null) or a non-empty string.
 */
export function dismissAuditIssueRequest(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "invalid_body", "Request body must be an object");
  }
  const reason = (body as Record<string, unknown>).reason;
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== "string") {
    throw new RequestError(400, "invalid_dismiss_reason", "reason must be a string", { field: "reason" });
  }
  const trimmed = reason.trim();
  return trimmed === "" ? null : trimmed;
}

export function recordDiscoveredUrlsRequest(body: unknown): RecordDiscoveredUrlsRequest {
  const input = objectBody(body);
  if (!Array.isArray(input.urls)) {
    throw new RequestError(400, "missing_field", "urls is required", { field: "urls" });
  }

  return {
    urls: input.urls.map((item, index) => discoveredUrlField(item, index))
  };
}

function discoveredUrlField(value: unknown, index: number): DiscoveredUrl {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "invalid_discovered_url", "Each discovered URL must be an object", { index });
  }
  const input = value as Record<string, unknown>;
  return {
    id: stringField(input, "id"),
    projectId: stringField(input, "projectId"),
    siteId: stringField(input, "siteId"),
    url: urlField(input, "url"),
    normalizedUrl: urlField(input, "normalizedUrl"),
    source: enumField(input, urlDiscoverySources, "source"),
    discoveredFrom: input.discoveredFrom === null || input.discoveredFrom === undefined ? null : urlField(input, "discoveredFrom"),
    depth: integerField(input, "depth", 0),
    discoveredAt: stringField(input, "discoveredAt")
  };
}

export function recordFetchResultRequest(body: unknown): RecordFetchResultRequest {
  const input = objectBody(body);
  return {
    url: urlField(input, "url"),
    finalUrl: urlField(input, "finalUrl"),
    statusCode: nullableStatusCodeField(input, "statusCode"),
    statusClass: enumField(input, fetchStatusClasses, "statusClass"),
    headers: stringRecordField(input, "headers"),
    redirectChain: urlArrayField(input, "redirectChain"),
    fetchedAt: stringField(input, "fetchedAt"),
    errorMessage: input.errorMessage === undefined ? undefined : stringField(input, "errorMessage")
  };
}

export function recordIndexabilityRequest(body: unknown): RecordIndexabilityRequest {
  const input = objectBody(body);
  return {
    url: urlField(input, "url"),
    state: enumField(input, indexabilityStates, "state"),
    isIndexable: booleanField(input, "isIndexable"),
    reasons: stringArrayField(input, "reasons"),
    canonicalUrl: input.canonicalUrl === null || input.canonicalUrl === undefined ? null : urlField(input, "canonicalUrl"),
    fetchResultId: input.fetchResultId === null || input.fetchResultId === undefined ? null : stringField(input, "fetchResultId"),
    assessedAt: stringField(input, "assessedAt")
  };
}

export function createIntegrationRequest(body: unknown): CreateIntegrationRequest {
  const input = objectBody(body);
  return {
    projectId: stringField(input, "projectId"),
    provider: enumField(input, integrationProviders, "provider")
  };
}

export function upsertIntegrationCredentialsRequest(body: unknown): UpsertIntegrationCredentialsRequest {
  const input = objectBody(body);
  return {
    projectId: stringField(input, "projectId"),
    provider: enumField(input, integrationProviders, "provider"),
    property: stringField(input, "property"),
    accessToken: stringField(input, "accessToken"),
    refreshToken: stringField(input, "refreshToken"),
    expiresAt: stringField(input, "expiresAt")
  };
}

export function createJobRequest(body: unknown): CreateJobRequest {
  const input = objectBody(body);
  return {
    projectId: stringField(input, "projectId"),
    type: enumField(input, jobTypes, "type"),
    subject: stringField(input, "subject"),
    payload: optionalRecordField(input, "payload")
  };
}

export function completeJobRequest(body: unknown): { status: Extract<FoundationJob["status"], "succeeded" | "failed">; lastError?: string } {
  const input = objectBody(body);
  const status = enumField(input, new Set<Extract<FoundationJob["status"], "succeeded" | "failed">>(["succeeded", "failed"]), "status");
  return {
    status,
    lastError: input.lastError === undefined ? undefined : stringField(input, "lastError")
  };
}

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "invalid_body", "Request body must be an object");
  }
  return body as Record<string, unknown>;
}

function stringField(input: Record<string, unknown>, field: string): string {
  if (typeof input[field] !== "string" || input[field].trim() === "") {
    throw new RequestError(400, "missing_field", `${field} is required`, { field });
  }
  return input[field].trim();
}

function slugField(input: Record<string, unknown>, field: string): string {
  const slug = stringField(input, field);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new RequestError(400, "invalid_slug", "slug must contain lowercase letters, numbers and dashes only", { field });
  }
  return slug;
}

function urlField(input: Record<string, unknown>, field: string): string {
  const value = stringField(input, field);
  try {
    new URL(value);
  } catch {
    throw new RequestError(400, "invalid_url", `${field} must be a valid URL`, { field });
  }
  return value;
}

function integerField(input: Record<string, unknown>, field: string, minimum?: number): number {
  const value = input[field];
  if (!Number.isInteger(value) || (minimum !== undefined && (value as number) < minimum)) {
    throw new RequestError(400, "invalid_integer", `${field} must be an integer`, { field, minimum });
  }
  return value as number;
}

function booleanField(input: Record<string, unknown>, field: string): boolean {
  if (typeof input[field] !== "boolean") {
    throw new RequestError(400, "invalid_boolean", `${field} must be a boolean`, { field });
  }
  return input[field];
}

function stringArrayField(input: Record<string, unknown>, field: string): string[] {
  const value = input[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new RequestError(400, "invalid_array", `${field} must be an array of strings`, { field });
  }
  return value;
}

function nullableStatusCodeField(input: Record<string, unknown>, field: string): number | null {
  if (input[field] === null) return null;
  const value = integerField(input, field, 100);
  if (value > 599) {
    throw new RequestError(400, "invalid_status_code", `${field} must be between 100 and 599`, { field });
  }
  return value;
}

function optionalRecordField(input: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
  if (input[field] === undefined) return undefined;
  const value = input[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "invalid_object", `${field} must be an object`, { field });
  }
  return value as Record<string, unknown>;
}

function stringRecordField(input: Record<string, unknown>, field: string): Record<string, string> {
  const value = input[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "invalid_object", `${field} must be an object`, { field });
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.toLowerCase(), String(item)]));
}

function urlArrayField(input: Record<string, unknown>, field: string): string[] {
  const value = input[field];
  if (!Array.isArray(value)) {
    throw new RequestError(400, "invalid_array", `${field} must be an array`, { field });
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new RequestError(400, "invalid_url", `${field} entries must be valid URLs`, { field, index });
    }
    try {
      new URL(item);
    } catch {
      throw new RequestError(400, "invalid_url", `${field} entries must be valid URLs`, { field, index });
    }
    return item;
  });
}

function enumField<T extends string>(input: Record<string, unknown>, allowed: Set<T>, field: string): T {
  const value = stringField(input, field) as T;
  if (!allowed.has(value)) {
    throw new RequestError(400, "invalid_enum", `${field} is invalid`, { field, allowed: [...allowed] });
  }
  return value;
}

function optionalEnum<T extends string>(value: unknown, allowed: Set<T>, field: string): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new RequestError(400, "invalid_enum", `${field} is invalid`, { field, allowed: [...allowed] });
  }
  return value as T;
}

