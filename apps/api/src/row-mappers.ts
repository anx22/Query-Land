import type { AuditIssueHistoryEntry, AuditIssueRecord, AuthUser, CrawlHealthScore, CrawlRun, DiscoveredUrl, FoundationJob, IndexabilityRecord, IntegrationAccount, IntegrationProvider, Project, Site, SourceMapEntry, UrlFetchRecord, UserRole } from "@seo-tool/domain-model";

export function mapUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as UserRole,
    status: row.status as AuthUser["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status as Project["status"],
    defaultLocale: String(row.default_locale),
    markets: JSON.parse(String(row.markets)) as Project["markets"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapSite(row: Record<string, unknown>): Site {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    scopeType: row.scope_type as Site["scopeType"],
    baseUrl: String(row.base_url),
    crawlFrequency: row.crawl_frequency as Site["crawlFrequency"],
    businessValue: Number(row.business_value)
  };
}

export function mapCrawlRun(row: Record<string, unknown>): CrawlRun {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    siteId: String(row.site_id),
    status: row.status as CrawlRun["status"],
    trigger: row.trigger as CrawlRun["trigger"],
    startedAt: String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
    summary: JSON.parse(String(row.summary)) as CrawlRun["summary"],
    errorMessage: row.error_message === null ? undefined : String(row.error_message)
  };
}

export function emptyCrawlRunSummary(): CrawlRun["summary"] {
  return { discoveredUrls: 0, fetchedUrls: 0, indexabilityAssessments: 0, openIssues: 0, healthScore: null };
}

export function mapDiscoveredUrl(row: Record<string, unknown>): DiscoveredUrl {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    siteId: String(row.site_id),
    url: String(row.url),
    normalizedUrl: String(row.normalized_url),
    source: row.source as DiscoveredUrl["source"],
    discoveredFrom: row.discovered_from === null ? null : String(row.discovered_from),
    depth: Number(row.depth),
    discoveredAt: String(row.discovered_at)
  };
}

export function mapUrlFetchRecord(row: Record<string, unknown>): UrlFetchRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    siteId: String(row.site_id),
    discoveredUrlId: String(row.discovered_url_id),
    url: String(row.url),
    finalUrl: String(row.final_url),
    statusCode: row.status_code === null ? null : Number(row.status_code),
    statusClass: row.status_class as UrlFetchRecord["statusClass"],
    headers: JSON.parse(String(row.headers)) as Record<string, string>,
    redirectChain: JSON.parse(String(row.redirect_chain)) as string[],
    fetchedAt: String(row.fetched_at),
    errorMessage: row.error_message === null ? undefined : String(row.error_message)
  };
}

export function mapIndexabilityRecord(row: Record<string, unknown>): IndexabilityRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    siteId: String(row.site_id),
    discoveredUrlId: String(row.discovered_url_id),
    fetchResultId: row.fetch_result_id === null ? null : String(row.fetch_result_id),
    url: String(row.url),
    state: row.state as IndexabilityRecord["state"],
    isIndexable: Number(row.is_indexable) === 1,
    reasons: JSON.parse(String(row.reasons)) as string[],
    canonicalUrl: row.canonical_url === null ? null : String(row.canonical_url),
    assessedAt: String(row.assessed_at)
  };
}

export function mapAuditIssueRecord(row: Record<string, unknown>): AuditIssueRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    siteId: String(row.site_id),
    discoveredUrlId: row.discovered_url_id === null ? null : String(row.discovered_url_id),
    url: String(row.url),
    rule: row.rule as AuditIssueRecord["rule"],
    severity: row.severity as AuditIssueRecord["severity"],
    message: String(row.message),
    detectedAt: String(row.detected_at),
    resolvedAt: row.resolved_at === null ? null : String(row.resolved_at),
    dismissedAt: row.dismissed_at === null || row.dismissed_at === undefined ? null : String(row.dismissed_at),
    dismissReason: row.dismiss_reason === null || row.dismiss_reason === undefined ? null : String(row.dismiss_reason),
    lastActor: row.last_actor === null || row.last_actor === undefined ? null : String(row.last_actor)
  };
}

export function mapAuditIssueHistoryEntry(row: Record<string, unknown>): AuditIssueHistoryEntry {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    siteId: String(row.site_id),
    issueId: String(row.issue_id),
    action: row.action as AuditIssueHistoryEntry["action"],
    actor: String(row.actor),
    reason: row.reason === null || row.reason === undefined ? null : String(row.reason),
    createdAt: String(row.created_at)
  };
}

export function mapCrawlHealthScore(row: Record<string, unknown>): CrawlHealthScore {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    siteId: String(row.site_id),
    score: Number(row.score),
    totalIssues: Number(row.total_issues),
    issueCounts: JSON.parse(String(row.issue_counts)) as CrawlHealthScore["issueCounts"],
    generatedAt: String(row.generated_at)
  };
}

export function countIssueSeverities(issues: Array<Pick<AuditIssueRecord, "severity">>): CrawlHealthScore["issueCounts"] {
  return issues.reduce<CrawlHealthScore["issueCounts"]>((counts, issue) => {
    counts[issue.severity] += 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0 });
}

export function mapIntegration(row: Record<string, unknown>): IntegrationAccount {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    provider: row.provider as IntegrationProvider,
    status: row.status as IntegrationAccount["status"],
    sourceConfidence: row.source_confidence as IntegrationAccount["sourceConfidence"],
    quotaRemaining: row.quota_remaining === null ? null : Number(row.quota_remaining),
    freshness: row.freshness === null ? null : String(row.freshness)
  };
}

export function mapJob(row: Record<string, unknown>): FoundationJob {
  const payload = parseJobPayload(row.payload);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    type: row.job_type as FoundationJob["type"],
    status: row.status as FoundationJob["status"],
    idempotencyKey: String(row.idempotency_key),
    subject: typeof payload.subject === "string" ? payload.subject : "",
    payload,
    attempts: Number(row.attempts),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function parseJobPayload(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value.trim() === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function mapSourceMapEntry(row: Record<string, unknown>): SourceMapEntry {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    urlPattern: String(row.url_pattern),
    template: String(row.template),
    component: String(row.component),
    repoPath: String(row.repo_path),
    confidence: row.confidence as SourceMapEntry["confidence"]
  };
}
