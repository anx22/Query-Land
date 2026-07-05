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

/**
 * The closed set of on-page / technical audit rules (Master-Spec §5 M2), grouped: HTTP & links,
 * title, canonical, meta description, headings/content, and page-level technical/i18n signals.
 * This array is the SINGLE SOURCE OF TRUTH — the `AuditIssueRule` type, the API validator, the route
 * filter and the web UI labels all derive from it, so adding a rule here is the only edit needed in
 * the domain layer (the compiler then flags each downstream place that must be updated).
 */
export const AUDIT_ISSUE_RULES = [
  // HTTP status & links
  "http_error",
  "redirect_chain",
  "broken_link",
  // Title
  "missing_title",
  "duplicate_title",
  "title_too_long",
  "title_too_short",
  // Canonical
  "canonical_mismatch",
  "missing_canonical",
  // Meta description
  "missing_meta_description",
  "duplicate_meta_description",
  "meta_description_too_long",
  "meta_description_too_short",
  // Headings & content
  "missing_h1",
  "multiple_h1",
  "thin_content",
  // Media, mobile & i18n / structured data
  "image_missing_alt",
  "missing_viewport",
  "missing_html_lang",
  "mixed_content",
  "hreflang_invalid",
  "structured_data_missing"
] as const;

export type AuditIssueRule = (typeof AUDIT_ISSUE_RULES)[number];

export interface AuditIssue {
  id: string;
  url: string;
  rule: AuditIssueRule;
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

/** A single URL in a crawl run's resumable BFS frontier (migration 016). */
export interface CrawlFrontierEntry {
  crawlRunId: string;
  normalizedUrl: string;
  depth: number;
  discoveredFrom: string | null;
  status: "pending" | "in_progress" | "done";
}

/**
 * On-page SEO signals extracted from a page's DOM — exactly what the standard on-page audit rules
 * need (meta description, headings, thin content, alt text, viewport, lang, hreflang, structured
 * data, mixed content). A flat, JSON-serializable shape so it can be persisted on the durable crawl
 * page signal (migration 019) and reconstructed when a resumable crawl is finalized from storage.
 */
export interface OnPageSignals {
  metaDescription: string | null;
  h1Count: number;
  wordCount: number;
  imagesMissingAlt: number;
  hasViewport: boolean;
  htmlLang: string | null;
  hreflangInvalid: boolean;
  hasJsonLd: boolean;
  mixedContentCount: number;
}

/** Neutral on-page signals for a page that could not be parsed (non-2xx / empty body). */
export const EMPTY_ON_PAGE_SIGNALS: OnPageSignals = {
  metaDescription: null,
  h1Count: 0,
  wordCount: 0,
  imagesMissingAlt: 0,
  hasViewport: false,
  htmlLang: null,
  hreflangInvalid: false,
  hasJsonLd: false,
  mixedContentCount: 0
};

/**
 * Durable per-page audit signals for a crawl run (migration 017 + 019). Captures
 * exactly what the audit rules need so a resumable crawl can be finalized from
 * storage after the frontier drains (no in-memory page set required).
 */
export interface CrawlPageSignal {
  crawlRunId: string;
  normalizedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  title: string | null;
  canonicalUrl: string | null;
  outgoingLinks: Array<{ url: string; statusCode: number | null }>;
  onPage: OnPageSignals;
}

/** Lightweight projection of an audit issue as it appears in a crawl-diff result. */
export interface CrawlRunDiffIssue {
  id: string;
  url: string;
  rule: AuditIssue["rule"];
  severity: AuditIssueSeverity;
  message: string;
}

/** Numeric deltas between the two runs, taken from their `summary` fields (compare - base). */
export interface CrawlRunDiffDeltas {
  /** compare.summary.healthScore - base.summary.healthScore; null when either side is null. */
  healthScore: number | null;
  openIssues: number;
  discoveredUrls: number;
}

export interface CrawlRunDiff {
  /** The chronologically older run id (smaller as-of time). */
  baseRunId: string;
  /** The chronologically newer run id (larger as-of time). */
  compareRunId: string;
  /** ISO timestamp used as "as of" for the base run (finishedAt ?? startedAt). */
  baseAsOf: string;
  /** ISO timestamp used as "as of" for the compare run (finishedAt ?? startedAt). */
  compareAsOf: string;
  /** Issues open as of compare but NOT open as of base. */
  appearedIssues: CrawlRunDiffIssue[];
  /** Issues open as of base but NOT open as of compare. */
  fixedIssues: CrawlRunDiffIssue[];
  /** Count of issues open as of both runs. */
  persistingCount: number;
  /** URLs whose discoveredAt is in (baseAsOf, compareAsOf]. */
  newUrls: DiscoveredUrl[];
  deltas: CrawlRunDiffDeltas;
}

/** "As of" time for a run: finishedAt, falling back to startedAt. */
function crawlRunAsOf(run: CrawlRun): string {
  return run.finishedAt ?? run.startedAt;
}

/**
 * Open as of T iff:
 *   detectedAt <= T AND (resolvedAt == null OR resolvedAt > T) AND (dismissedAt == null OR dismissedAt > T)
 * ISO-8601 timestamps compare correctly as strings (lexicographic == chronological).
 */
function isIssueOpenAsOf(issue: AuditIssueRecord, asOf: string): boolean {
  if (issue.detectedAt > asOf) return false;
  if (issue.resolvedAt != null && issue.resolvedAt <= asOf) return false;
  if (issue.dismissedAt != null && issue.dismissedAt <= asOf) return false;
  return true;
}

function toDiffIssue(issue: AuditIssueRecord): CrawlRunDiffIssue {
  return { id: issue.id, url: issue.url, rule: issue.rule, severity: issue.severity, message: issue.message };
}

function nullableDelta(compare: number | null, base: number | null): number | null {
  if (compare == null || base == null) return null;
  return compare - base;
}

/**
 * Pure crawl-run diff. Reconstructs the open-issue set "as of" each run's time from
 * the lifecycle fields (detectedAt/resolvedAt/dismissedAt) and diffs the two runs.
 *
 * Robust to argument order: the runs are reordered chronologically by their as-of time
 * (finishedAt ?? startedAt) so the result is always a base->compare comparison where
 * compare is the newer run. If the two as-of times are equal, the arguments are kept
 * as passed (first = base, second = compare).
 */
export function computeCrawlRunDiff(
  base: CrawlRun,
  compare: CrawlRun,
  issues: AuditIssueRecord[],
  urls: DiscoveredUrl[]
): CrawlRunDiff {
  // Order chronologically so compare is always the newer run.
  const [olderRun, newerRun] = crawlRunAsOf(compare) < crawlRunAsOf(base) ? [compare, base] : [base, compare];
  const baseAsOf = crawlRunAsOf(olderRun);
  const compareAsOf = crawlRunAsOf(newerRun);

  const appearedIssues: CrawlRunDiffIssue[] = [];
  const fixedIssues: CrawlRunDiffIssue[] = [];
  let persistingCount = 0;

  for (const issue of issues) {
    const openAtBase = isIssueOpenAsOf(issue, baseAsOf);
    const openAtCompare = isIssueOpenAsOf(issue, compareAsOf);
    if (openAtCompare && !openAtBase) {
      appearedIssues.push(toDiffIssue(issue));
    } else if (openAtBase && !openAtCompare) {
      fixedIssues.push(toDiffIssue(issue));
    } else if (openAtBase && openAtCompare) {
      persistingCount += 1;
    }
  }

  // discoveredAt in (baseAsOf, compareAsOf] — discovered after base, up to and including compare.
  const newUrls = urls.filter((url) => url.discoveredAt > baseAsOf && url.discoveredAt <= compareAsOf);

  return {
    baseRunId: olderRun.id,
    compareRunId: newerRun.id,
    baseAsOf,
    compareAsOf,
    appearedIssues,
    fixedIssues,
    persistingCount,
    newUrls,
    deltas: {
      healthScore: nullableDelta(newerRun.summary.healthScore, olderRun.summary.healthScore),
      openIssues: newerRun.summary.openIssues - olderRun.summary.openIssues,
      discoveredUrls: newerRun.summary.discoveredUrls - olderRun.summary.discoveredUrls
    }
  };
}

const issueSeverityWeights: Record<AuditIssueSeverity, number> = {
  critical: 18,
  high: 10,
  medium: 5,
  low: 2
};

/**
 * Health score (0–100) from open issues, with per-kind diminishing returns.
 *
 * Issues are grouped by `rule` (or by severity when no rule is given). Within a group the FIRST
 * issue costs its full severity weight; each further issue of the SAME kind costs progressively
 * less — the group penalty is `maxWeight × (1 + log2(n))`. This keeps the score trustworthy: a
 * single noisy rule (e.g. 40 low-severity duplicate titles, or a site-wide www→apex canonical
 * strategy) can no longer floor an otherwise healthy site to 0, while a spread of DISTINCT, severe
 * problems still lowers the score sharply (distinct rules each contribute their full weight).
 */
export function calculateHealthScore(
  issues: Array<Pick<AuditIssue, "severity"> & Partial<Pick<AuditIssue, "rule">>>
): number {
  const groups = new Map<string, number[]>();
  for (const issue of issues) {
    const key = issue.rule ?? `severity:${issue.severity}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(issueSeverityWeights[issue.severity]);
    else groups.set(key, [issueSeverityWeights[issue.severity]]);
  }
  let penalty = 0;
  for (const weights of groups.values()) {
    const representative = Math.max(...weights);
    penalty += representative * (1 + Math.log2(weights.length));
  }
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}
