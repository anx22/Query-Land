import { randomUUID } from "node:crypto";
import type { DiscoveredUrl, FetchStatusClass, FoundationJob, IndexabilityRecord, IndexabilityState, IntegrationProvider, ProjectStatus, SiteScopeType, UrlDiscoverySource, UrlFetchRecord } from "@seo-tool/domain-model";
import { createSQLiteStore, RequestError, type BackendStore } from "./sqlite-store.js";

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface RequestContext {
  headers?: Record<string, string | undefined>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

type MarketInput = { country: string; language: string; device: "desktop" | "mobile"; searchEngine: "google" | "bing" };
type CreateProjectRequest = { name: string; slug: string; status?: ProjectStatus; defaultLocale?: string; markets?: MarketInput[] };
type CreateSiteRequest = { baseUrl: string; scopeType: SiteScopeType; crawlFrequency?: "manual" | "daily" | "weekly"; businessValue?: number };
type RecordDiscoveredUrlsRequest = { urls: DiscoveredUrl[] };
type RecordFetchResultRequest = Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">;
type RecordIndexabilityRequest = Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">;
type CreateIntegrationRequest = { projectId: string; provider: IntegrationProvider };
type CreateJobRequest = { projectId: string; type: FoundationJob["type"]; subject: string };
type AuthRequest = { email: string; password: string; name?: string };

const projectStatuses = new Set<ProjectStatus>(["draft", "active", "archived"]);
const siteScopeTypes = new Set<SiteScopeType>(["domain", "subdomain", "folder"]);
const crawlFrequencies = new Set<Exclude<CreateSiteRequest["crawlFrequency"], undefined>>(["manual", "daily", "weekly"]);
const urlDiscoverySources = new Set<UrlDiscoverySource>(["seed", "sitemap", "link"]);
const fetchStatusClasses = new Set<FetchStatusClass>(["success", "redirect", "client_error", "server_error", "network_error"]);
const indexabilityStates = new Set<IndexabilityState>(["indexable", "blocked_by_status", "blocked_by_meta", "blocked_by_x_robots", "canonicalized"]);
const integrationProviders = new Set<IntegrationProvider>(["gsc", "ga4", "matomo", "pagespeed", "lighthouse", "serverlogs", "sitemap", "robots", "crawler", "cms", "serp", "backlink", "keyword"]);
const jobTypes = new Set<FoundationJob["type"]>(["connector_sync", "crawl_seed", "source_map_refresh", "health_check"]);

export function createApp(store: BackendStore = createSQLiteStore()) {
  return async function appHandleRequest(method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
    return routeRequest(store, method, pathname, body, context);
  };
}

const defaultHandleRequest = createApp();

export async function handleRequest(method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  return defaultHandleRequest(method, pathname, body, context);
}

async function routeRequest(store: BackendStore, method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  const requestId = context.headers?.["x-request-id"] ?? context.headers?.["X-Request-Id"] ?? `req-${randomUUID()}`;

  try {
    const response = await routeTopLevel(store, method, pathname, body, context, requestId);
    logRequest(method, pathname, response.status, requestId);
    return response;
  } catch (error) {
    const response = error instanceof RequestError
      ? apiError(error.status, error.code, error.message, requestId, error.details)
      : error instanceof Error
        ? apiError(400, "validation_error", error.message, requestId)
        : apiError(500, "internal_error", "Internal error", requestId);
    logRequest(method, pathname, response.status, requestId);
    return response;
  }
}

async function routeProjectChildren(store: BackendStore, method: string, pathname: string, body: unknown, requestId: string): Promise<ApiResponse> {
  const siteMatch = pathname.match(/^\/projects\/([^/]+)\/sites$/);
  if (method === "GET" && siteMatch) {
    return json(200, { data: store.listSites(siteMatch[1]) });
  }
  if (method === "POST" && siteMatch) {
    return json(201, { data: store.createSite(siteMatch[1], createSiteRequest(body)) });
  }

  const discoveredUrlsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls$/);
  if (method === "GET" && discoveredUrlsMatch) {
    return json(200, { data: store.listDiscoveredUrls(discoveredUrlsMatch[1], discoveredUrlsMatch[2]) });
  }
  if (method === "POST" && discoveredUrlsMatch) {
    const input = recordDiscoveredUrlsRequest(body);
    const result = store.recordDiscoveredUrls(discoveredUrlsMatch[1], discoveredUrlsMatch[2], input.urls);
    return json(201, { data: result.urls, meta: { inserted: result.inserted, updated: result.updated } });
  }

  const fetchResultsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls\/([^/]+)\/fetch-results$/);
  if (method === "GET" && fetchResultsMatch) {
    return json(200, { data: store.listFetchResults(fetchResultsMatch[1], fetchResultsMatch[2], fetchResultsMatch[3]) });
  }
  if (method === "POST" && fetchResultsMatch) {
    const input = recordFetchResultRequest(body);
    return json(201, { data: store.recordFetchResult(fetchResultsMatch[1], fetchResultsMatch[2], fetchResultsMatch[3], input) });
  }

  const indexabilityMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls\/([^/]+)\/indexability$/);
  if (method === "GET" && indexabilityMatch) {
    return json(200, { data: store.listIndexabilityAssessments(indexabilityMatch[1], indexabilityMatch[2], indexabilityMatch[3]) });
  }
  if (method === "POST" && indexabilityMatch) {
    const input = recordIndexabilityRequest(body);
    return json(201, { data: store.recordIndexabilityAssessment(indexabilityMatch[1], indexabilityMatch[2], indexabilityMatch[3], input) });
  }

  if (method === "GET" && pathname === "/integrations") {
    return json(200, { data: store.listIntegrations() });
  }
  if (method === "POST" && pathname === "/integrations") {
    const input = createIntegrationRequest(body);
    return json(201, { data: store.createIntegration(input.projectId, input.provider) });
  }
  if (method === "POST" && pathname === "/auth/register") {
    const input = authRequest(body, true);
    return json(201, { data: store.registerUser(input) });
  }
  if (method === "POST" && pathname === "/auth/login") {
    const input = authRequest(body, false);
    const result = store.login(input.email, input.password);
    return result ? json(200, { data: result }) : apiError(401, "invalid_credentials", "Invalid credentials", requestId);
  }
  if (method === "GET" && pathname === "/source-map") {
    return json(200, { data: store.listSourceMapEntries() });
  }
  return apiError(404, "not_found", "Route not found", requestId);
}

function authRequest(body: unknown, allowName: boolean): AuthRequest {
  const input = objectBody(body);
  const email = stringField(input, "email");
  const password = stringField(input, "password");
  const name = allowName && typeof input.name === "string" ? input.name : undefined;
  return { email, password, name };
}

function createProjectRequest(body: unknown): CreateProjectRequest {
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

function createSiteRequest(body: unknown): CreateSiteRequest {
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

function recordDiscoveredUrlsRequest(body: unknown): RecordDiscoveredUrlsRequest {
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

function recordFetchResultRequest(body: unknown): RecordFetchResultRequest {
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

function recordIndexabilityRequest(body: unknown): RecordIndexabilityRequest {
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

function createIntegrationRequest(body: unknown): CreateIntegrationRequest {
  const input = objectBody(body);
  return {
    projectId: stringField(input, "projectId"),
    provider: enumField(input, integrationProviders, "provider")
  };
}

function createJobRequest(body: unknown): CreateJobRequest {
  const input = objectBody(body);
  return {
    projectId: stringField(input, "projectId"),
    type: enumField(input, jobTypes, "type"),
    subject: stringField(input, "subject")
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
  if (method === "GET" && pathname === "/projects") {
    return json(200, { data: store.listProjects() });
  }
  if (method === "POST" && pathname === "/projects") {
    return json(201, { data: store.createProject(createProjectRequest(body)) });
  }

  return routeProjectChildren(store, method, pathname, body, requestId);
}
