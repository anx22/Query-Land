export type UrlDiscoverySource = "seed" | "sitemap" | "link";
export type FetchStatusClass = "success" | "redirect" | "client_error" | "server_error" | "network_error";
export type IndexabilityState = "indexable" | "blocked_by_status" | "blocked_by_meta" | "blocked_by_x_robots" | "blocked_by_robots" | "canonicalized";
export type AuditIssueSeverity = "critical" | "high" | "medium" | "low";
export type CrawlRunStatus = "running" | "succeeded" | "failed";

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
  responseBody?: string;
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

export type AuditIssueLifecycleAction = "resolve" | "dismiss" | "reopen";

export interface AuditIssueRecord extends AuditIssue {
  projectId: string;
  siteId: string;
  discoveredUrlId: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  /** Set when the issue was explicitly dismissed (distinct from resolved). */
  dismissedAt?: string | null;
  /** Free-text reason captured at dismiss time. */
  dismissReason?: string | null;
  /** Actor (userId or "system") who last changed this issue's lifecycle. */
  lastActor?: string | null;
}

/** A single lifecycle transition for an audit issue (queryable per-issue history). */
export interface AuditIssueHistoryEntry {
  id: string;
  projectId: string;
  siteId: string;
  issueId: string;
  action: AuditIssueLifecycleAction;
  actor: string;
  reason: string | null;
  createdAt: string;
}

export interface CrawlRun {
  id: string;
  projectId: string;
  siteId: string;
  status: CrawlRunStatus;
  trigger: "manual" | "scheduled" | "deploy";
  startedAt: string;
  finishedAt: string | null;
  summary: {
    discoveredUrls: number;
    fetchedUrls: number;
    indexabilityAssessments: number;
    openIssues: number;
    healthScore: number | null;
  };
  errorMessage?: string;
}

export interface CrawlHealthScore {
  id: string;
  projectId: string;
  siteId: string;
  score: number;
  totalIssues: number;
  issueCounts: Record<AuditIssueSeverity, number>;
  generatedAt: string;
}

const issueSeverityWeights: Record<AuditIssueSeverity, number> = {
  critical: 18,
  high: 10,
  medium: 5,
  low: 2
};

export function calculateHealthScore(issues: Array<Pick<AuditIssue, "severity">>): number {
  const penalty = issues.reduce((sum, issue) => sum + issueSeverityWeights[issue.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
