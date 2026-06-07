/**
 * overview-api.ts — server-side data loader for the Overview dashboard (UX-1).
 *
 * Loads all data the Overview needs from real API endpoints.
 * Each section is loaded defensively: any error returns null / empty array —
 * the chart islands render empty-states, not crashes.
 *
 * Data-source mapping (per spec §B / §5.4):
 *   TrendChart       → /projects/{id}/visibility (real VisibilityScore[])
 *   ScoreGauge       → /projects/{id}/sites/{sid}/health-scores (CrawlHealthScore[])
 *   PositionDist     → /projects/{id}/keywords/{kw}/rank-snapshots aggregated over all keywords
 *                      Substitution: since there is no "all rank snapshots" endpoint, we load
 *                      all keywords first then collect the latest rank snapshot per keyword via
 *                      /projects/{id}/keywords/{kw}/rank-snapshots.
 *                      For large sets we cap at 50 keywords — noted in report.
 *   Top-Chancen      → /projects/{id}/opportunities?limit=5&status=open
 *   Risks            → /projects/{id}/sites/{sid}/audit-issues?status=open&severity=critical
 *   Crawl runs       → /projects/{id}/sites/{sid}/crawl-runs
 *   Reports          → /projects/{id}/reports
 */

import type { CrawlHealthScore, CrawlRun, AuditIssueRecord, Opportunity, VisibilityScore } from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope } from "./api-client";
import { loadFoundationDashboardData, type FoundationProject, type FoundationSite } from "./foundation-api";

// ---------------------------------------------------------------------------
// Sub-types for rank bucket aggregation
// ---------------------------------------------------------------------------

export interface PositionBuckets {
  top3: number;
  top10: number;
  strikingDist: number;
  mid: number;
  weak: number;
  total: number;
}

function emptyBuckets(): PositionBuckets {
  return { top3: 0, top10: 0, strikingDist: 0, mid: 0, weak: 0, total: 0 };
}

export function positionToBucket(position: number): keyof Omit<PositionBuckets, "total"> | null {
  if (!Number.isFinite(position) || position < 1) return null;
  if (position <= 3) return "top3";
  if (position <= 10) return "top10";
  if (position <= 20) return "strikingDist";
  if (position <= 50) return "mid";
  if (position <= 100) return "weak";
  return null;
}

// ---------------------------------------------------------------------------
// Trend data point (plain/serialisable for client islands)
// ---------------------------------------------------------------------------

export interface TrendDataPoint {
  /** X-axis label (formatted date) */
  label: string;
  /** Visibility score (0–100) */
  value: number;
}

// ---------------------------------------------------------------------------
// Main result shape
// ---------------------------------------------------------------------------

export interface OverviewData {
  /** Is the API reachable? */
  connected: boolean;
  errorMessage?: string;

  project: FoundationProject | null;
  site: FoundationSite | null;

  /** Visibility trend (TrendChart hero). Empty if no data. */
  visibilityTrend: TrendDataPoint[];
  /** Latest visibility score (for KPI chip) */
  latestVisibility: VisibilityScore | null;
  /** Previous visibility score (for DeltaChip) */
  previousVisibility: VisibilityScore | null;

  /** Latest health score. Null if not yet computed. */
  latestHealthScore: CrawlHealthScore | null;
  /** Previous health score (for DeltaChip). Null if only one entry. */
  previousHealthScore: CrawlHealthScore | null;

  /** Aggregated position buckets across all keywords. */
  positionBuckets: PositionBuckets;

  /** Top open opportunities (capped at 5). */
  topOpportunities: Opportunity[];

  /** Open critical audit issues. */
  criticalIssues: AuditIssueRecord[];

  /** Recent crawl runs (latest first, capped at 5). */
  recentCrawlRuns: CrawlRun[];

  /** Reports list (latest first, capped at 5). */
  recentReports: Array<{ id: string; title: string; type: string; generatedAt: string }>;
}

function emptyOverview(project: FoundationProject | null, site: FoundationSite | null, opts: { connected: boolean; errorMessage?: string } = { connected: false }): OverviewData {
  return {
    ...opts,
    project,
    site,
    visibilityTrend: [],
    latestVisibility: null,
    previousVisibility: null,
    latestHealthScore: null,
    previousHealthScore: null,
    positionBuckets: emptyBuckets(),
    topOpportunities: [],
    criticalIssues: [],
    recentCrawlRuns: [],
    recentReports: [],
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadOverviewData(): Promise<OverviewData> {
  const dashboard = await loadFoundationDashboardData();
  const project = dashboard.selectedProject;
  const site = dashboard.sites[0] ?? null;

  if (!dashboard.connected || !project) {
    return emptyOverview(project, site, {
      connected: dashboard.connected,
      errorMessage: dashboard.errorMessage,
    });
  }

  const pid = project.id;
  const sid = site?.id;

  // Run all requests in parallel, each catching its own errors silently.
  const [
    visibilityScores,
    healthScores,
    topOpportunities,
    criticalIssues,
    recentCrawlRuns,
    reports,
    keywords,
  ] = await Promise.all([
    // 1. Visibility trend
    apiGet<VisibilityScore[]>(`/projects/${pid}/visibility`).catch(() => [] as VisibilityScore[]),

    // 2. Health scores (site-scoped)
    sid
      ? apiGet<CrawlHealthScore[]>(`/projects/${pid}/sites/${sid}/health-scores`).catch(() => [] as CrawlHealthScore[])
      : Promise.resolve([] as CrawlHealthScore[]),

    // 3. Top 5 open opportunities
    apiGetEnvelope<Opportunity[]>(`/projects/${pid}/opportunities?status=open&limit=5`)
      .then((env) => env.data.slice(0, 5))
      .catch(() => [] as Opportunity[]),

    // 4. Open critical issues (site-scoped)
    sid
      ? apiGetEnvelope<AuditIssueRecord[]>(`/projects/${pid}/sites/${sid}/audit-issues?status=open&severity=critical&limit=10`)
          .then((env) => env.data)
          .catch(() => [] as AuditIssueRecord[])
      : Promise.resolve([] as AuditIssueRecord[]),

    // 5. Recent crawl runs (site-scoped)
    sid
      ? apiGetEnvelope<CrawlRun[]>(`/projects/${pid}/sites/${sid}/crawl-runs?limit=5`)
          .then((env) => env.data.slice(0, 5))
          .catch(() => [] as CrawlRun[])
      : Promise.resolve([] as CrawlRun[]),

    // 6. Recent reports
    apiGet<Array<{ id: string; title: string; type: string; generatedAt: string }>>(
      `/projects/${pid}/reports`
    ).catch(() => []),

    // 7. Keywords list (for rank-bucket aggregation — paginated, cap at 50)
    apiGetEnvelope<Array<{ id: string }>>(
      `/projects/${pid}/keywords?limit=50`
    ).then((env) => env.data).catch(() => [] as Array<{ id: string }>),
  ]);

  // --- Visibility trend ---
  const sortedVisibility = [...(Array.isArray(visibilityScores) ? visibilityScores : [])].sort(
    (a, b) => a.computedAt.localeCompare(b.computedAt)
  );
  const visibilityTrend: TrendDataPoint[] = sortedVisibility.map((v) => ({
    label: new Date(v.computedAt).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "numeric",
    }),
    value: v.score,
  }));
  const latestVisibility = sortedVisibility[sortedVisibility.length - 1] ?? null;
  const previousVisibility = sortedVisibility.length >= 2 ? sortedVisibility[sortedVisibility.length - 2] : null;

  // --- Health scores ---
  const sortedHealth = [...(Array.isArray(healthScores) ? healthScores : [])].sort(
    (a, b) => a.generatedAt.localeCompare(b.generatedAt)
  );
  const latestHealthScore = sortedHealth[sortedHealth.length - 1] ?? null;
  const previousHealthScore = sortedHealth.length >= 2 ? sortedHealth[sortedHealth.length - 2] : null;

  // --- Position buckets ---
  // Fetch the latest rank snapshot per keyword (capped at 50 keywords).
  const keywordIds = (Array.isArray(keywords) ? keywords : []).slice(0, 50).map((k) => k.id);
  const buckets = emptyBuckets();

  if (keywordIds.length > 0) {
    const rankResults = await Promise.allSettled(
      keywordIds.map((kwId) =>
        apiGet<Array<{ position: number | null; capturedAt: string }>>(
          `/projects/${pid}/keywords/${kwId}/rank-snapshots`
        ).catch(() => [])
      )
    );
    for (const result of rankResults) {
      if (result.status !== "fulfilled") continue;
      const snaps = result.value;
      if (!Array.isArray(snaps) || snaps.length === 0) continue;
      // Most recent snapshot for this keyword
      const latest = [...snaps].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
      if (latest.position == null || !Number.isFinite(latest.position)) continue;
      const bucket = positionToBucket(latest.position);
      if (bucket) {
        buckets[bucket]++;
        buckets.total++;
      }
    }
  }

  return {
    connected: true,
    project,
    site,
    visibilityTrend,
    latestVisibility,
    previousVisibility,
    latestHealthScore,
    previousHealthScore,
    positionBuckets: buckets,
    topOpportunities: Array.isArray(topOpportunities) ? topOpportunities : [],
    criticalIssues: Array.isArray(criticalIssues) ? criticalIssues : [],
    recentCrawlRuns: Array.isArray(recentCrawlRuns) ? recentCrawlRuns : [],
    recentReports: (Array.isArray(reports) ? reports : []).slice(0, 5),
  };
}
