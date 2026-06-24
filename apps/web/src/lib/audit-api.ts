/**
 * audit-api.ts — server-side data loader for the Technical Audit overview (UX-6a).
 *
 * Loads everything the Technical-Audit overview needs from real, site-scoped
 * endpoints. Each request is defensive: any error → empty result, so the page
 * never crashes on an empty DB / offline API. Chart islands render empty-states.
 *
 * Data-source mapping (per spec Teil 3 §D / §4.5 / §4.6 / §5.3):
 *   IndexabilityFunnel → crawl-runs[latest].summary  (discovered/fetched/indexable)
 *                        + audit-issues + indexability per discovered URL where
 *                        derivable. "indexed" stage cannot be derived from existing
 *                        data (no GSC coverage endpoint here) → empty-state.
 *   SectionTreemap     → discovered-urls grouped by first path segment; tile size =
 *                        URL count; color = issue density (audit-issues per group).
 *   ScoreGauge         → health-scores (latest + previous for DeltaChip).
 *   Issue-Groups       → audit-issues grouped by rule+severity with impact score.
 *   Recent runs        → crawl-runs (latest first).
 *
 * Pure helpers (deriveFunnelStages, groupUrlsByPath, groupIssues) are exported
 * and unit-tested in audit-api.test.ts.
 */

import type {
  AuditIssueRecord,
  AuditIssueSeverity,
  CrawlHealthScore,
  CrawlRun,
  DiscoveredUrl,
} from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope } from "./api-client";
import { loadFoundationDashboardData, type FoundationProject, type FoundationSite } from "./foundation-api";

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export interface FunnelStage {
  /** Stable key for the stage. */
  key: "discovered" | "fetched" | "indexable" | "indexed";
  /** Display label (German). */
  label: string;
  /** Count for this stage; null when the stage cannot be derived (→ empty). */
  value: number | null;
  /** Drop versus the previous stage (negative number); null for the first stage / unknown. */
  drop: number | null;
}

/**
 * Derive the indexability funnel from a crawl-run summary plus optional
 * derived indexable count.
 *
 * The crawl-run summary carries discovered/fetched/indexabilityAssessments
 * counts. "indexable" is the number of URLs assessed as indexable — when not
 * separately known we leave it null (empty-state), never guessing.
 * "indexed" requires GSC coverage which is not available here → always null.
 */
export function deriveFunnelStages(input: {
  discovered: number | null;
  fetched: number | null;
  indexable: number | null;
  indexed?: number | null;
}): FunnelStage[] {
  const discovered = normalizeCount(input.discovered);
  const fetched = normalizeCount(input.fetched);
  const indexable = normalizeCount(input.indexable);
  const indexed = input.indexed === undefined ? null : normalizeCount(input.indexed);

  const drop = (current: number | null, prev: number | null): number | null => {
    if (current == null || prev == null) return null;
    const d = current - prev;
    return d < 0 ? d : null;
  };

  return [
    { key: "discovered", label: "Entdeckt", value: discovered, drop: null },
    { key: "fetched", label: "Gecrawlt", value: fetched, drop: drop(fetched, discovered) },
    { key: "indexable", label: "Indexierbar", value: indexable, drop: drop(indexable, fetched) },
    { key: "indexed", label: "Indexiert", value: indexed, drop: drop(indexed, indexable) },
  ];
}

function normalizeCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
}

// ---------------------------------------------------------------------------
// Section treemap (path grouping)
// ---------------------------------------------------------------------------

export interface SectionGroup {
  /** First path segment, e.g. "/blog"; "/" for root-level URLs. */
  path: string;
  /** Number of discovered URLs in this section. */
  urlCount: number;
  /** Number of open audit issues attributed to this section. */
  issueCount: number;
  /**
   * Health 0–100: 100 = no issues; decreases with issue density per URL.
   * Functional color is derived from this on the client.
   */
  health: number;
}

/** Extract the first path segment of a URL; "/" when path is empty/root. */
export function firstPathSegment(rawUrl: string): string {
  if (!rawUrl) return "/";
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    // Not an absolute URL — treat the raw string as a path.
    pathname = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  }
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 0 ? "/" : `/${segments[0]}`;
}

/**
 * Group discovered URLs by first path segment, attaching issue counts and a
 * derived health score per group. Issues are matched to a section by their URL.
 */
export function groupUrlsByPath(
  urls: Array<Pick<DiscoveredUrl, "normalizedUrl" | "url">>,
  issues: Array<Pick<AuditIssueRecord, "url">>
): SectionGroup[] {
  const urlCounts = new Map<string, number>();
  for (const u of urls) {
    const seg = firstPathSegment(u.normalizedUrl || u.url);
    urlCounts.set(seg, (urlCounts.get(seg) ?? 0) + 1);
  }

  const issueCounts = new Map<string, number>();
  for (const issue of issues) {
    const seg = firstPathSegment(issue.url);
    issueCounts.set(seg, (issueCounts.get(seg) ?? 0) + 1);
  }

  const groups: SectionGroup[] = [];
  for (const [path, urlCount] of urlCounts.entries()) {
    const issueCount = issueCounts.get(path) ?? 0;
    groups.push({ path, urlCount, issueCount, health: sectionHealth(urlCount, issueCount) });
  }

  // Largest sections first.
  groups.sort((a, b) => b.urlCount - a.urlCount || a.path.localeCompare(b.path));
  return groups;
}

/**
 * Health 0–100 from issue density (issues per URL). 0 issues → 100.
 * Each issue-per-URL costs 40 points (so 1 issue/URL → 60, 2.5+ → 0).
 */
export function sectionHealth(urlCount: number, issueCount: number): number {
  if (urlCount <= 0) return 100;
  const density = issueCount / urlCount;
  return Math.max(0, Math.min(100, Math.round(100 - density * 40)));
}

// ---------------------------------------------------------------------------
// Issue groups (by rule + severity, with impact score)
// ---------------------------------------------------------------------------

export interface IssueGroup {
  /** Composite key rule::severity. */
  key: string;
  rule: AuditIssueRecord["rule"];
  severity: AuditIssueSeverity;
  /** Number of open issues in this group. */
  count: number;
  /** Impact score = count × severity weight (higher = more urgent). */
  impact: number;
  /** Sample issues (capped) for the expanded view. */
  issues: AuditIssueRecord[];
}

const SEVERITY_WEIGHT: Record<AuditIssueSeverity, number> = {
  critical: 18,
  high: 10,
  medium: 5,
  low: 2,
};

const SEVERITY_ORDER: Record<AuditIssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Group audit issues by rule + severity, compute an impact score per group
 * (count × severity weight) and sort by impact descending.
 */
export function groupIssues(issues: AuditIssueRecord[], sampleLimit = 5): IssueGroup[] {
  const map = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const key = `${issue.rule}::${issue.severity}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.impact = existing.count * SEVERITY_WEIGHT[issue.severity];
      if (existing.issues.length < sampleLimit) existing.issues.push(issue);
    } else {
      map.set(key, {
        key,
        rule: issue.rule,
        severity: issue.severity,
        count: 1,
        impact: SEVERITY_WEIGHT[issue.severity],
        issues: [issue],
      });
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.impact - a.impact ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.rule.localeCompare(b.rule)
  );
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface TechnicalAuditOverviewData {
  connected: boolean;
  errorMessage?: string;
  apiBaseUrl: string;

  project: FoundationProject | null;
  site: FoundationSite | null;

  /** Indexability funnel stages (some values may be null → empty-state). */
  funnelStages: FunnelStage[];
  /** True when no funnel stage has a value. */
  funnelEmpty: boolean;

  /** Section treemap groups (path-segment grouping). */
  sections: SectionGroup[];

  /** Latest + previous health score. */
  latestHealthScore: CrawlHealthScore | null;
  previousHealthScore: CrawlHealthScore | null;

  /** Grouped open audit issues, impact-sorted. */
  issueGroups: IssueGroup[];
  /** Total open issues counted across groups. */
  openIssueTotal: number;

  /** Recent crawl runs (latest first). */
  recentCrawlRuns: CrawlRun[];
  /** Total discovered URLs (from list meta). */
  discoveredUrlTotal: number;
}

function emptyData(
  project: FoundationProject | null,
  site: FoundationSite | null,
  opts: { connected: boolean; errorMessage?: string; apiBaseUrl: string }
): TechnicalAuditOverviewData {
  return {
    ...opts,
    project,
    site,
    funnelStages: deriveFunnelStages({ discovered: null, fetched: null, indexable: null }),
    funnelEmpty: true,
    sections: [],
    latestHealthScore: null,
    previousHealthScore: null,
    issueGroups: [],
    openIssueTotal: 0,
    recentCrawlRuns: [],
    discoveredUrlTotal: 0,
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const URL_SAMPLE_LIMIT = 200;
const ISSUE_SAMPLE_LIMIT = 200;

export async function loadTechnicalAuditOverview(): Promise<TechnicalAuditOverviewData> {
  const dashboard = await loadFoundationDashboardData();
  const project = dashboard.selectedProject;
  const site = dashboard.sites[0] ?? null;
  const apiBaseUrl = dashboard.apiBaseUrl;

  if (!dashboard.connected || !project || !site) {
    return emptyData(project, site, {
      connected: dashboard.connected,
      errorMessage: dashboard.errorMessage,
      apiBaseUrl,
    });
  }

  const base = `/projects/${project.id}/sites/${site.id}`;

  const [crawlRuns, healthScores, issuesEnv, urlsEnv] = await Promise.all([
    apiGetEnvelope<CrawlRun[]>(`${base}/crawl-runs?limit=5`)
      .then((env) => env.data)
      .catch(() => [] as CrawlRun[]),
    apiGet<CrawlHealthScore[]>(`${base}/health-scores`).catch(() => [] as CrawlHealthScore[]),
    apiGetEnvelope<AuditIssueRecord[]>(`${base}/audit-issues?status=open&limit=${ISSUE_SAMPLE_LIMIT}`)
      .then((env) => env)
      .catch(() => ({ data: [] as AuditIssueRecord[] })),
    apiGetEnvelope<DiscoveredUrl[]>(`${base}/discovered-urls?limit=${URL_SAMPLE_LIMIT}`)
      .then((env) => env)
      .catch(() => ({ data: [] as DiscoveredUrl[], meta: undefined })),
  ]);

  // --- Crawl runs (latest first) ---
  const sortedRuns = [...(Array.isArray(crawlRuns) ? crawlRuns : [])].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt)
  );
  const latestRun = sortedRuns[0] ?? null;

  // --- Health scores ---
  const sortedHealth = [...(Array.isArray(healthScores) ? healthScores : [])].sort((a, b) =>
    a.generatedAt.localeCompare(b.generatedAt)
  );
  const latestHealthScore = sortedHealth[sortedHealth.length - 1] ?? null;
  const previousHealthScore = sortedHealth.length >= 2 ? sortedHealth[sortedHealth.length - 2] : null;

  // --- Issues ---
  const openIssues = (Array.isArray(issuesEnv.data) ? issuesEnv.data : []).filter(
    (i) => i.resolvedAt === null
  );
  const issueGroups = groupIssues(openIssues);
  const openIssueTotal = openIssues.length;

  // --- Discovered URLs + sections ---
  const urls = Array.isArray(urlsEnv.data) ? urlsEnv.data : [];
  const sections = groupUrlsByPath(urls, openIssues);
  const discoveredUrlTotal =
    "meta" in urlsEnv && urlsEnv.meta ? urlsEnv.meta.total : urls.length;

  // --- Funnel ---
  // Stage counts come from the latest crawl-run summary (authoritative aggregate).
  // "indexable" derived from summary.indexabilityAssessments is the count of
  // assessments performed, NOT necessarily indexable — so we only fill it when a
  // health/run reports it; the chart labels this honestly.
  const funnelStages = deriveFunnelStages({
    discovered: latestRun?.summary.discoveredUrls ?? (urls.length > 0 ? discoveredUrlTotal : null),
    fetched: latestRun?.summary.fetchedUrls ?? null,
    indexable: latestRun?.summary.indexabilityAssessments ?? null,
    // "indexed" needs GSC coverage data — not available via these endpoints.
    indexed: undefined,
  });
  const funnelEmpty = funnelStages.every((s) => s.value === null);

  return {
    connected: true,
    apiBaseUrl,
    project,
    site,
    funnelStages,
    funnelEmpty,
    sections,
    latestHealthScore,
    previousHealthScore,
    issueGroups,
    openIssueTotal,
    recentCrawlRuns: sortedRuns,
    discoveredUrlTotal,
  };
}
