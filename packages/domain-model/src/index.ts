export type SourceConfidence = "A" | "B" | "C" | "D" | "E";
export type ProjectStatus = "draft" | "active" | "archived";
export type SiteScopeType = "domain" | "subdomain" | "folder";
export type IntegrationProvider = "gsc" | "ga4" | "matomo" | "pagespeed" | "lighthouse" | "serverlogs" | "sitemap" | "robots" | "crawler" | "cms" | "serp" | "backlink" | "keyword";
export type IntegrationStatus = "disconnected" | "pending" | "connected" | "degraded" | "error";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type MappingConfidence = "exact" | "manifest" | "heuristic" | "unknown";
export type UserRole = "owner" | "editor" | "viewer";
export type UserStatus = "active" | "disabled";

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  defaultLocale: string;
  markets: Market[];
  createdAt: string;
  updatedAt: string;
}

export interface Market {
  country: string;
  language: string;
  device: "desktop" | "mobile";
  searchEngine: "google" | "bing";
}

export interface Site {
  id: string;
  projectId: string;
  scopeType: SiteScopeType;
  baseUrl: string;
  crawlFrequency: "manual" | "daily" | "weekly";
  businessValue: number;
}

export interface IntegrationAccount {
  id: string;
  projectId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  sourceConfidence: SourceConfidence;
  quotaRemaining: number | null;
  freshness: string | null;
}

export interface FoundationJob {
  id: string;
  projectId: string;
  type: "connector_sync" | "crawl_seed" | "source_map_refresh" | "health_check";
  status: JobStatus;
  idempotencyKey: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceMapEntry {
  id: string;
  projectId: string;
  urlPattern: string;
  template: string;
  component: string;
  repoPath: string;
  confidence: MappingConfidence;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface HealthSnapshot {
  status: "ok" | "degraded";
  service: string;
  version: string;
  checkedAt: string;
  checks: Array<{ name: string; status: "ok" | "warn" | "fail"; details?: string }>;
}

const confidenceByProvider: Record<IntegrationProvider, SourceConfidence> = {
  gsc: "B",
  ga4: "A",
  matomo: "A",
  pagespeed: "B",
  lighthouse: "A",
  serverlogs: "A",
  sitemap: "A",
  robots: "A",
  crawler: "A",
  cms: "A",
  serp: "C",
  backlink: "D",
  keyword: "D"
};

export function sourceConfidenceForProvider(provider: IntegrationProvider): SourceConfidence {
  return confidenceByProvider[provider];
}

export function makeIdempotencyKey(projectId: string, jobType: FoundationJob["type"], subject: string): string {
  return `${projectId}:${jobType}:${subject}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
}

export function validateBusinessValue(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("businessValue must be an integer between 1 and 100");
  }
  return value;
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("email must be valid");
  }
  return normalized;
}

export function validatePassword(password: string): string {
  if (password.length < 12) {
    throw new Error("password must contain at least 12 characters");
  }
  return password;
}
