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

import { AUDIT_ISSUE_RULES } from "@seo-tool/domain-model";
import type {
  AuditIssueRecord,
  AuditIssueSeverity,
  CrawlHealthScore,
  CrawlRun,
  CrawlRunDiff,
  DiscoveredUrl,
} from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope, emptyListMeta, type ListMeta } from "./api-client";
import { loadFoundationDashboardData, type FoundationProject, type FoundationSite } from "./foundation-api";
import { computeReadiness, type ReadinessState } from "./readiness";
import {
  resolveOffset,
  resolveUrlExplorerFilter,
  URL_EXPLORER_PAGE_SIZE,
  type UrlExplorerFilter,
  type UrlExplorerRow,
} from "../features/technical-audit/url-explorer";
import {
  hasCompleteSelection,
  resolveDiffSelection,
  type DiffSelection,
} from "../features/technical-audit/crawl-diff";

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

  /**
   * Sections whose API fetch FAILED (vs. genuinely empty). Lets the page show an
   * honest error notice instead of an indistinguishable empty/healthy state
   * (archetype B — see DOCS/architecture/archetypal-bug-audit.md).
   */
  loadErrors: string[];

  project: FoundationProject | null;
  site: FoundationSite | null;
  /** Setup-waterfall state, so the crawl-start control can lock/unlock. */
  readiness: ReadinessState;

  /** Indexability funnel stages (some values may be null → empty-state). */
  funnelStages: FunnelStage[];
  /** True when no funnel stage has a value. */
  funnelEmpty: boolean;

  /** Section treemap groups (path-segment grouping). */
  sections: SectionGroup[];

  /** Latest + previous health score. */
  latestHealthScore: CrawlHealthScore | null;
  previousHealthScore: CrawlHealthScore | null;

  /** Grouped audit issues for the active filter, impact-sorted. */
  issueGroups: IssueGroup[];
  /** Total open issues counted across groups. */
  openIssueTotal: number;
  /** Active server-side issue filter (status + severity). */
  activeIssueFilter: IssueFilter;
  /** Total issues matching the active filter (from list meta). */
  displayedIssueTotal: number;

  /** Recent crawl runs (latest first), for the active run page. */
  recentCrawlRuns: CrawlRun[];
  /** Active offset for the recent-runs pagination. */
  runOffset: number;
  /** Total number of crawl runs (from list meta). */
  runTotal: number;
  /** Total discovered URLs (from list meta). */
  discoveredUrlTotal: number;

  /** URL-Explorer rows for the active URL page. */
  urlExplorerRows: UrlExplorerRow[];
  /** Pagination meta for the URL-Explorer table. */
  urlExplorerMeta: ListMeta;
  /** Active server-side URL-Explorer filter (fetch status class + source). */
  activeUrlFilter: UrlExplorerFilter;

  /**
   * Runs offered in the crawl-diff selectors (newest first, capped), independent
   * of the recent-runs pagination so cross-page comparisons stay selectable.
   */
  diffSelectableRuns: CrawlRun[];
  /** Active crawl-diff selection (resolved against the available runs). */
  diffSelection: DiffSelection;
  /**
   * Crawl-diff result for the active selection; null when fewer than two runs
   * exist, no/partial selection, or the diff fetch failed. Only fetched when
   * both diffBase & diffCompare are present.
   */
  crawlDiff: CrawlRunDiff | null;
}

/** Page size for the recent crawl-runs list. */
export const RUN_PAGE_SIZE = 5;

/** Max runs offered in the crawl-diff selectors (newest first). */
export const DIFF_RUN_LIMIT = 50;

function emptyData(
  project: FoundationProject | null,
  site: FoundationSite | null,
  opts: { connected: boolean; errorMessage?: string; apiBaseUrl: string; readiness: ReadinessState }
): TechnicalAuditOverviewData {
  return {
    ...opts,
    loadErrors: [],
    project,
    site,
    funnelStages: deriveFunnelStages({ discovered: null, fetched: null, indexable: null }),
    funnelEmpty: true,
    sections: [],
    latestHealthScore: null,
    previousHealthScore: null,
    issueGroups: [],
    openIssueTotal: 0,
    activeIssueFilter: { status: "open", severity: "all", rule: "all" },
    displayedIssueTotal: 0,
    recentCrawlRuns: [],
    runOffset: 0,
    runTotal: 0,
    discoveredUrlTotal: 0,
    urlExplorerRows: [],
    urlExplorerMeta: emptyListMeta(0),
    activeUrlFilter: { status: "all", source: "all", q: "" },
    diffSelectableRuns: [],
    diffSelection: { base: null, compare: null },
    crawlDiff: null,
  };
}

// ---------------------------------------------------------------------------
// Issue filter (server-side: status + severity)
// ---------------------------------------------------------------------------

export type IssueStatusFilter = "open" | "resolved" | "all";
export type IssueSeverityFilter = "all" | "critical" | "high" | "medium" | "low";
export type IssueRuleFilter = "all" | AuditIssueRecord["rule"];

export interface IssueFilter {
  status: IssueStatusFilter;
  severity: IssueSeverityFilter;
  rule: IssueRuleFilter;
}

export const ISSUE_STATUS_FILTERS: IssueStatusFilter[] = ["open", "resolved", "all"];
export const ISSUE_SEVERITY_FILTERS: IssueSeverityFilter[] = ["all", "critical", "high", "medium", "low"];
export const ISSUE_RULE_FILTERS: IssueRuleFilter[] = ["all", ...AUDIT_ISSUE_RULES];

/** Normalize raw query input into a valid filter, defaulting to open / all / all rules. */
export function resolveIssueFilter(
  input: { issueStatus?: string; issueSeverity?: string; issueRule?: string } = {}
): IssueFilter {
  const status = ISSUE_STATUS_FILTERS.includes(input.issueStatus as IssueStatusFilter)
    ? (input.issueStatus as IssueStatusFilter)
    : "open";
  const severity = ISSUE_SEVERITY_FILTERS.includes(input.issueSeverity as IssueSeverityFilter)
    ? (input.issueSeverity as IssueSeverityFilter)
    : "all";
  const rule = ISSUE_RULE_FILTERS.includes(input.issueRule as IssueRuleFilter)
    ? (input.issueRule as IssueRuleFilter)
    : "all";
  return { status, severity, rule };
}

export function isDefaultIssueFilter(filter: IssueFilter): boolean {
  return filter.status === "open" && filter.severity === "all" && filter.rule === "all";
}

function matchesStatus(issue: AuditIssueRecord, status: IssueStatusFilter): boolean {
  if (status === "all") return true;
  return status === "resolved" ? issue.resolvedAt !== null : issue.resolvedAt === null;
}

function matchesRule(issue: AuditIssueRecord, rule: IssueRuleFilter): boolean {
  return rule === "all" || issue.rule === rule;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const URL_SAMPLE_LIMIT = 200;
const ISSUE_SAMPLE_LIMIT = 200;

/** Build the /url-explorer query string for the active page + filter. */
function buildUrlExplorerQuery(offset: number, filter: UrlExplorerFilter): string {
  const params = new URLSearchParams({
    limit: String(URL_EXPLORER_PAGE_SIZE),
    offset: String(offset),
  });
  if (filter.status !== "all") params.set("status", filter.status);
  if (filter.source !== "all") params.set("source", filter.source);
  if (filter.q !== "") params.set("q", filter.q);
  return params.toString();
}

export async function loadTechnicalAuditOverview(
  options: {
    issueStatus?: string;
    issueSeverity?: string;
    issueRule?: string;
    urlStatus?: string;
    urlSource?: string;
    urlQ?: string;
    urlOffset?: string;
    runOffset?: string;
    diffBase?: string;
    diffCompare?: string;
  } = {}
): Promise<TechnicalAuditOverviewData> {
  const dashboard = await loadFoundationDashboardData();
  const project = dashboard.selectedProject;
  const site = dashboard.selectedSite ?? dashboard.sites[0] ?? null;
  const apiBaseUrl = dashboard.apiBaseUrl;
  const activeIssueFilter = resolveIssueFilter(options);
  const activeUrlFilter = resolveUrlExplorerFilter(options);
  const readiness = computeReadiness({
    projects: dashboard.projects,
    selectedProject: dashboard.selectedProject,
    sites: dashboard.sites,
    integrations: dashboard.integrations,
    jobs: dashboard.jobs,
  });

  if (!dashboard.connected || !project || !site) {
    return {
      ...emptyData(project, site, {
        connected: dashboard.connected,
        errorMessage: dashboard.errorMessage,
        apiBaseUrl,
        readiness,
      }),
      activeIssueFilter,
      activeUrlFilter,
    };
  }

  const base = `/projects/${project.id}/sites/${site.id}`;

  // Resolve the requested run page offset (URL offset is resolved after we know
  // the total, below). These paginate the runs/URL lists only — never the
  // overview aggregates (funnel/sections/health/issues stay stable).
  const runOffset = resolveOffset(options.runOffset, RUN_PAGE_SIZE);
  const requestedUrlOffset = resolveOffset(options.urlOffset, URL_EXPLORER_PAGE_SIZE);

  // Empty ≠ Error: a failed fetch records its section here so the page can show an
  // honest error notice instead of a silent empty/healthy state (archetype B).
  const loadErrors: string[] = [];
  const [runsEnv, healthScores, issuesEnv, urlsEnv, urlExplorerEnv, indexStatus] = await Promise.all([
    apiGetEnvelope<CrawlRun[]>(`${base}/crawl-runs?limit=${RUN_PAGE_SIZE}&offset=${runOffset}`)
      .then((env) => env)
      .catch(() => { loadErrors.push("Crawl-Läufe"); return { data: [] as CrawlRun[], meta: undefined }; }),
    apiGet<CrawlHealthScore[]>(`${base}/health-scores`).catch(() => { loadErrors.push("Health-Scores"); return [] as CrawlHealthScore[]; }),
    apiGetEnvelope<AuditIssueRecord[]>(`${base}/audit-issues?status=open&limit=${ISSUE_SAMPLE_LIMIT}`)
      .then((env) => env)
      .catch(() => { loadErrors.push("Issues"); return { data: [] as AuditIssueRecord[] }; }),
    apiGetEnvelope<DiscoveredUrl[]>(`${base}/discovered-urls?limit=${URL_SAMPLE_LIMIT}`)
      .then((env) => env)
      .catch(() => { loadErrors.push("Discovered URLs"); return { data: [] as DiscoveredUrl[], meta: undefined }; }),
    apiGetEnvelope<UrlExplorerRow[]>(`${base}/url-explorer?${buildUrlExplorerQuery(requestedUrlOffset, activeUrlFilter)}`)
      .then((env) => env)
      .catch(() => { loadErrors.push("URL-Explorer"); return { data: [] as UrlExplorerRow[], meta: undefined }; }),
    // Index coverage from the GSC URL Inspection sync. Supplementary — a miss here leaves the funnel's
    // "indexed" stage empty (honest) rather than flagging the whole audit as errored.
    apiGet<{ indexed: number; total: number; inspectedAt: string | null }>(`${base}/index-status/summary`)
      .catch(() => ({ indexed: 0, total: 0, inspectedAt: null })),
  ]);

  // --- Crawl runs (active page, latest first) ---
  const crawlRuns = runsEnv.data;
  const sortedRuns = [...(Array.isArray(crawlRuns) ? crawlRuns : [])].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt)
  );
  const runTotal = "meta" in runsEnv && runsEnv.meta ? runsEnv.meta.total : sortedRuns.length;
  // The funnel needs the single newest run regardless of the active run page.
  // It is the page-0 first run; fetch it cheaply only when paging away from 0.
  let latestRun = runOffset === 0 ? (sortedRuns[0] ?? null) : null;
  if (runOffset > 0) {
    latestRun = await apiGetEnvelope<CrawlRun[]>(`${base}/crawl-runs?limit=1`)
      .then((env) => env.data?.[0] ?? null)
      .catch(() => { if (!loadErrors.includes("Crawl-Läufe")) loadErrors.push("Crawl-Läufe"); return null; });
  }

  // --- Health scores ---
  const sortedHealth = [...(Array.isArray(healthScores) ? healthScores : [])].sort((a, b) =>
    a.generatedAt.localeCompare(b.generatedAt)
  );
  const latestHealthScore = sortedHealth[sortedHealth.length - 1] ?? null;
  const previousHealthScore = sortedHealth.length >= 2 ? sortedHealth[sortedHealth.length - 2] : null;

  // --- Issues ---
  // Open issues drive the overview (sections, funnel, health), independent of
  // the display filter below.
  const openIssues = (Array.isArray(issuesEnv.data) ? issuesEnv.data : []).filter(
    (i) => i.resolvedAt === null
  );
  const openIssueTotal = openIssues.length;

  // Displayed issue groups honor the active status/severity filter (server-side).
  // Only fetch again when the filter differs from the default open/all set.
  let displayedEnv: { data: AuditIssueRecord[]; meta?: { total: number } } = issuesEnv;
  if (!isDefaultIssueFilter(activeIssueFilter)) {
    const issueParams = new URLSearchParams({ status: activeIssueFilter.status, limit: String(ISSUE_SAMPLE_LIMIT) });
    if (activeIssueFilter.severity !== "all") issueParams.set("severity", activeIssueFilter.severity);
    if (activeIssueFilter.rule !== "all") issueParams.set("rule", activeIssueFilter.rule);
    displayedEnv = await apiGetEnvelope<AuditIssueRecord[]>(`${base}/audit-issues?${issueParams.toString()}`)
      .then((env) => env)
      .catch(() => { if (!loadErrors.includes("Issues")) loadErrors.push("Issues"); return { data: [] as AuditIssueRecord[] }; });
  }
  const displayedIssues = (Array.isArray(displayedEnv.data) ? displayedEnv.data : []).filter(
    (i) => matchesStatus(i, activeIssueFilter.status) && matchesRule(i, activeIssueFilter.rule)
  );
  const issueGroups = groupIssues(displayedIssues);
  const displayedIssueTotal =
    "meta" in displayedEnv && displayedEnv.meta ? displayedEnv.meta.total : displayedIssues.length;

  // --- Discovered URLs + sections ---
  const urls = Array.isArray(urlsEnv.data) ? urlsEnv.data : [];
  const sections = groupUrlsByPath(urls, openIssues);
  const discoveredUrlTotal =
    "meta" in urlsEnv && urlsEnv.meta ? urlsEnv.meta.total : urls.length;

  // --- URL-Explorer (paginated rows for the table island) ---
  const urlExplorerRows = Array.isArray(urlExplorerEnv.data) ? urlExplorerEnv.data : [];
  const urlExplorerMeta =
    "meta" in urlExplorerEnv && urlExplorerEnv.meta
      ? urlExplorerEnv.meta
      : { limit: URL_EXPLORER_PAGE_SIZE, offset: requestedUrlOffset, total: urlExplorerRows.length, nextCursor: null };

  // --- Funnel ---
  // Stage counts come from the latest crawl-run summary (authoritative aggregate).
  // "indexable" derived from summary.indexabilityAssessments is the count of
  // assessments performed, NOT necessarily indexable — so we only fill it when a
  // health/run reports it; the chart labels this honestly.
  const funnelStages = deriveFunnelStages({
    discovered: latestRun?.summary.discoveredUrls ?? (urls.length > 0 ? discoveredUrlTotal : null),
    fetched: latestRun?.summary.fetchedUrls ?? null,
    indexable: latestRun?.summary.indexabilityAssessments ?? null,
    // "indexed" is the count Google reports as indexed via the URL Inspection sync. Undefined (honest
    // empty) until a URL-inspection run has happened for this site.
    indexed: indexStatus.total > 0 ? indexStatus.indexed : undefined,
  });
  const funnelEmpty = funnelStages.every((s) => s.value === null);

  // --- Crawl-diff (UX-6b) ---
  // Only do diff-related work when the user has touched the selectors. With no
  // diffBase/diffCompare in the query the section renders its placeholder from
  // the already-fetched recent runs — no extra fetch (overview stays stable).
  const diffRequested = options.diffBase != null || options.diffCompare != null;

  // Selector universe: when a diff is requested, fetch a dedicated, larger run
  // list (newest first) so two runs from different recent-runs pages stay
  // comparable. Otherwise reuse the runs already on the active page.
  const diffSelectableRuns = diffRequested
    ? await apiGetEnvelope<CrawlRun[]>(`${base}/crawl-runs?limit=${DIFF_RUN_LIMIT}`)
        .then((env) =>
          [...(Array.isArray(env.data) ? env.data : [])].sort((a, b) =>
            b.startedAt.localeCompare(a.startedAt)
          )
        )
        .catch(() => sortedRuns)
    : sortedRuns;

  // Resolve the requested selection against the selectable runs; unknown ids are
  // dropped. The diff is only fetched when both sides are present.
  const diffSelection = resolveDiffSelection(
    { diffBase: options.diffBase, diffCompare: options.diffCompare },
    diffSelectableRuns.map((r) => r.id)
  );

  let crawlDiff: CrawlRunDiff | null = null;
  if (hasCompleteSelection(diffSelection)) {
    const diffParams = new URLSearchParams({
      base: diffSelection.base as string,
      compare: diffSelection.compare as string,
    });
    crawlDiff = await apiGet<CrawlRunDiff>(`${base}/crawl-runs/diff?${diffParams.toString()}`).catch(
      () => null
    );
  }

  return {
    connected: true,
    apiBaseUrl,
    loadErrors,
    project,
    site,
    readiness,
    funnelStages,
    funnelEmpty,
    sections,
    latestHealthScore,
    previousHealthScore,
    issueGroups,
    openIssueTotal,
    activeIssueFilter,
    displayedIssueTotal,
    recentCrawlRuns: sortedRuns,
    runOffset,
    runTotal,
    discoveredUrlTotal,
    urlExplorerRows,
    urlExplorerMeta,
    activeUrlFilter,
    diffSelectableRuns,
    diffSelection,
    crawlDiff,
  };
}
