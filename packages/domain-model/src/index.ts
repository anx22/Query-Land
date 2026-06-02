export type SourceConfidence = "A" | "B" | "C" | "D" | "E";
export type ProjectStatus = "draft" | "active" | "archived";
export type SiteScopeType = "domain" | "subdomain" | "folder";
export type IntegrationProvider = "gsc" | "ga4" | "matomo" | "pagespeed" | "lighthouse" | "serverlogs" | "sitemap" | "robots" | "crawler" | "cms" | "serp" | "backlink" | "keyword";
export type IntegrationStatus = "disconnected" | "pending" | "connected" | "degraded" | "error";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type MappingConfidence = "exact" | "manifest" | "heuristic" | "unknown";
export type UserRole = "owner" | "editor" | "viewer";
export type UserStatus = "active" | "disabled";
export type OpportunityStatus = "open" | "planned" | "in_progress" | "implemented" | "validated" | "reopened" | "dismissed" | "expired";

export interface Evidence {
  source: string;
  sourceConfidence: SourceConfidence;
  metric: string;
  beforeValue: number | string;
  currentValue: number | string;
  timeWindow: string;
  affectedEntity: string;
}

export interface SourceAnchor {
  repositoryPath: string;
  templateName: string;
  confidence: "exact" | "manifest" | "heuristic";
}

export interface Opportunity {
  id: string;
  projectId: string;
  type: "technical_fix" | "low_hanging_keyword" | "cannibalization" | "money_page" | "internal_link_gap" | "aeo";
  affectedUrls: string[];
  affectedKeywords: string[];
  affectedClusters: string[];
  sourceAnchor?: SourceAnchor;
  evidence: Evidence[];
  currentState: string;
  recommendedAction: string;
  expectedImpact: number;
  effort: number;
  confidence: number;
  businessValue: number;
  urgency: number;
  priority: number;
  validationMetric: string;
  owner: string;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface Market {
  country: string;
  language: string;
  device: "desktop" | "mobile";
  searchEngine: "google" | "bing";
}

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

export interface SeoMemorySnapshot {
  principles: string[];
  foundationGate: string[];
  deliveryWave: "foundation" | "audit-core";
  sourceOfTruth: string[];
}

export type UrlDiscoverySource = "seed" | "sitemap" | "link";
export type FetchStatusClass = "success" | "redirect" | "client_error" | "server_error" | "network_error";
export type IndexabilityState = "indexable" | "blocked_by_status" | "blocked_by_meta" | "blocked_by_x_robots" | "canonicalized";
export type AuditIssueSeverity = "critical" | "high" | "medium" | "low";

export interface DiscoveredUrl {
  id: string;
  projectId: string;
  siteId: string;
  url: string;
  normalizedUrl: string;
  source: UrlDiscoverySource;
  discoveredFrom: string | null;
  depth: number;
  discoveredAt: string;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  statusCode: number | null;
  statusClass: FetchStatusClass;
  headers: Record<string, string>;
  redirectChain: string[];
  fetchedAt: string;
  errorMessage?: string;
}

export interface UrlFetchRecord extends FetchResult {
  id: string;
  projectId: string;
  siteId: string;
  discoveredUrlId: string;
}

export interface IndexabilityAssessment {
  url: string;
  state: IndexabilityState;
  isIndexable: boolean;
  reasons: string[];
  canonicalUrl: string | null;
}

export interface IndexabilityRecord extends IndexabilityAssessment {
  id: string;
  projectId: string;
  siteId: string;
  discoveredUrlId: string;
  fetchResultId: string | null;
  assessedAt: string;
}

export interface AuditIssue {
  id: string;
  url: string;
  rule: "http_error" | "redirect_chain" | "missing_title" | "duplicate_title" | "canonical_mismatch" | "broken_link";
  severity: AuditIssueSeverity;
  message: string;
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

const issueSeverityWeights: Record<AuditIssueSeverity, number> = {
  critical: 18,
  high: 10,
  medium: 5,
  low: 2
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

export function scoreOpportunity(input: Pick<Opportunity, "expectedImpact" | "confidence" | "businessValue" | "urgency" | "effort">): number {
  if (input.effort <= 0) {
    throw new Error("Opportunity effort must be greater than zero.");
  }

  return Math.round((input.expectedImpact * input.confidence * input.businessValue * input.urgency * 100) / input.effort);
}

export function hasRequiredEvidence(opportunity: Pick<Opportunity, "evidence">): boolean {
  return opportunity.evidence.some((item) => ["A", "B", "C"].includes(item.sourceConfidence));
}

export function calculateHealthScore(issues: Array<Pick<AuditIssue, "severity">>): number {
  const penalty = issues.reduce((sum, issue) => sum + issueSeverityWeights[issue.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
