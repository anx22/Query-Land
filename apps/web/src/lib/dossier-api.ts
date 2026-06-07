/**
 * dossier-api.ts — server-side data loader for the URL Dossier (UX-4, Inspector 360°).
 *
 * One URL rendered as a complete SEO object. Every request is loaded defensively:
 * any error returns null / empty array so each section renders its empty-state
 * rather than crashing the page. The build runs against an empty DB.
 *
 * Data-source mapping (per spec Teil 3 §E / §5.1):
 *   Identität + Quell-Verknüpfung → /source-map/resolve + url-explorer row
 *   Fetch / Indexierbarkeit (+Mini-Timeline) → discovered-urls/{id}/fetch-results + /indexability
 *   GSC-Leistung (Klicks/Impr./Position + Sparkline) → /sites/{sid}/search-performance
 *        (?pageUrl= is best-effort 🟡 — we also filter client-side by selected URL)
 *   Rankings/Queries → keywords mapped to URL → /keywords/{kw}/rank-snapshots (best-effort)
 *   interne Links (In/Out) → /sites/{sid}/internal-links?direction=in|out&url=
 *   externe Links (Backlinks auf URL) → /projects/{pid}/backlinks (filter targetUrl client-side)
 *   Web Vitals → /sites/{sid}/web-vitals (site-scoped 🟡 — not per-URL)
 *   Issues → /sites/{sid}/audit-issues (filter to URL)
 *   Chancen → /projects/{pid}/opportunities (filter to URL)
 */

import type {
  AuditIssueRecord,
  Backlink,
  DiscoveredUrl,
  IndexabilityRecord,
  Keyword,
  Opportunity,
  RankSnapshot,
  SearchPerformanceRow,
  UrlFetchRecord
} from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope } from "./api-client";
import {
  loadFoundationDashboardData,
  type FoundationDashboardData,
  type FoundationProject,
  type FoundationSite
} from "./foundation-api";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface InternalLinkEdgeRow {
  id: string;
  fromUrl: string;
  toUrl: string;
  anchor: string | null;
  rel: string | null;
}

export interface ResolvedSourceAnchor {
  urlPattern: string;
  template: string;
  component: string;
  repoPath: string;
  confidence: string;
}

/** Web-side mirror of the API's WebVitalMetric (defined in the API store). */
export interface WebVitalMetric {
  metric: string;
  value: number;
  measuredAt: string;
  sourceConfidence: string;
}

interface UrlExplorerRow {
  discoveredUrl: DiscoveredUrl;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
}

/** Aggregated GSC totals for the selected URL + sparkline series. */
export interface GscPerformance {
  clicks: number;
  impressions: number;
  /** Click-through rate as a 0–1 fraction (weighted by impressions). */
  ctr: number;
  /** Impression-weighted average position. */
  position: number;
  /** Number of GSC rows that matched the URL. */
  rowCount: number;
  /** Clicks over time (oldest → newest) for the Sparkline. */
  clicksTrend: number[];
  /** Average position over time (oldest → newest) for the Sparkline. */
  positionTrend: number[];
  /** Top queries for this URL, sorted by impressions desc. */
  topQueries: SearchPerformanceRow[];
}

/** One keyword mapped to the URL with its latest rank snapshot. */
export interface RankingRow {
  keyword: Keyword;
  latest: RankSnapshot | null;
  /** Position history (oldest → newest), nulls dropped, for a Sparkline. */
  positionTrend: number[];
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UrlDossierData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  urlOptions: string[];
  selectedUrl: string | null;
  discoveredUrl: DiscoveredUrl | null;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
  fetchHistory: UrlFetchRecord[];
  indexabilityHistory: IndexabilityRecord[];
  gsc: GscPerformance | null;
  rankings: RankingRow[];
  inlinks: InternalLinkEdgeRow[];
  outlinks: InternalLinkEdgeRow[];
  backlinks: Backlink[];
  webVitals: WebVitalMetric[];
  issues: AuditIssueRecord[];
  opportunities: Opportunity[];
  sourceAnchor: ResolvedSourceAnchor | null;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in dossier-api.test.ts)
// ---------------------------------------------------------------------------

/** Normalises a URL for tolerant comparison (drops trailing slash + lowercases host). */
export function canonicalizeUrl(url: string): string {
  if (!url) return "";
  let value = url.trim();
  // Drop trailing slash(es) so "…/a" and "…/a/" compare equal.
  value = value.replace(/(.)\/+$/, "$1");
  return value.toLowerCase();
}

/** True when two URLs refer to the same resource (tolerant of trailing slash/case). */
export function urlsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return canonicalizeUrl(a) === canonicalizeUrl(b);
}

/**
 * Aggregates GSC rows for a single URL into totals + trend series.
 * Returns null when no rows match (caller renders the empty-state).
 */
export function aggregateGsc(rows: SearchPerformanceRow[], selectedUrl: string): GscPerformance | null {
  const matched = rows.filter((row) => urlsMatch(row.pageUrl, selectedUrl));
  if (matched.length === 0) return null;

  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  for (const row of matched) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position = impressions > 0 ? weightedPosition / impressions : 0;

  // Build trend series ordered oldest → newest by capturedAt.
  const byDate = [...matched].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const clicksTrend = byDate.map((row) => row.clicks);
  const positionTrend = byDate.map((row) => row.position);

  const topQueries = [...matched].sort((a, b) => b.impressions - a.impressions).slice(0, 10);

  return {
    clicks,
    impressions,
    ctr: Number(ctr.toFixed(4)),
    position: Number(position.toFixed(1)),
    rowCount: matched.length,
    clicksTrend,
    positionTrend,
    topQueries
  };
}

/** Builds a positive position-trend series (oldest → newest), dropping null positions. */
export function rankPositionTrend(snapshots: RankSnapshot[]): number[] {
  return [...snapshots]
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((snap) => snap.position)
    .filter((position): position is number => typeof position === "number" && Number.isFinite(position));
}

/** Picks the most recent rank snapshot (by capturedAt). */
export function latestRankSnapshot(snapshots: RankSnapshot[]): RankSnapshot | null {
  if (snapshots.length === 0) return null;
  return [...snapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
}

// ---------------------------------------------------------------------------
// Empty result
// ---------------------------------------------------------------------------

function empty(
  dashboard: FoundationDashboardData,
  selectedSite: FoundationSite | null,
  selectedUrl: string | null,
  urlOptions: string[] = []
): UrlDossierData {
  return {
    ...dashboard,
    selectedSite,
    urlOptions,
    selectedUrl,
    discoveredUrl: null,
    latestFetch: null,
    latestIndexability: null,
    fetchHistory: [],
    indexabilityHistory: [],
    gsc: null,
    rankings: [],
    inlinks: [],
    outlinks: [],
    backlinks: [],
    webVitals: [],
    issues: [],
    opportunities: [],
    sourceAnchor: null
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadUrlDossier(options: { url?: string } = {}): Promise<UrlDossierData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;
  if (!dashboard.connected || !dashboard.selectedProject || !selectedSite) {
    return empty(dashboard, selectedSite, options.url ?? null);
  }

  const project: FoundationProject = dashboard.selectedProject;
  const pid = project.id;
  const sid = selectedSite.id;
  const base = `/projects/${pid}/sites/${sid}`;

  try {
    const explorer = (await apiGetEnvelope<UrlExplorerRow[]>(`${base}/url-explorer?limit=100`)).data;
    const urlOptions = explorer.map((row) => row.discoveredUrl.normalizedUrl);
    const selectedUrl =
      options.url && urlOptions.some((candidate) => urlsMatch(candidate, options.url))
        ? urlOptions.find((candidate) => urlsMatch(candidate, options.url)) ?? null
        : urlOptions[0] ?? null;

    if (!selectedUrl) {
      return empty(dashboard, selectedSite, options.url ?? null, urlOptions);
    }

    const selectedRow = explorer.find((row) => row.discoveredUrl.normalizedUrl === selectedUrl) ?? null;
    const discoveredUrl = selectedRow?.discoveredUrl ?? null;
    const encodedUrl = encodeURIComponent(selectedUrl);

    const [
      fetchHistory,
      indexabilityHistory,
      gscRows,
      inlinks,
      outlinks,
      backlinksAll,
      webVitals,
      issuesAll,
      opportunitiesAll,
      keywordsAll,
      sourceAnchor
    ] = await Promise.all([
      discoveredUrl
        ? apiGet<UrlFetchRecord[]>(`${base}/discovered-urls/${discoveredUrl.id}/fetch-results`).catch(() => [] as UrlFetchRecord[])
        : Promise.resolve([] as UrlFetchRecord[]),
      discoveredUrl
        ? apiGet<IndexabilityRecord[]>(`${base}/discovered-urls/${discoveredUrl.id}/indexability`).catch(() => [] as IndexabilityRecord[])
        : Promise.resolve([] as IndexabilityRecord[]),
      // GSC: ?pageUrl= is best-effort — we pass it AND filter client-side in aggregateGsc.
      apiGetEnvelope<SearchPerformanceRow[]>(`${base}/search-performance?pageUrl=${encodedUrl}&limit=500`)
        .then((r) => r.data)
        .catch(() => [] as SearchPerformanceRow[]),
      apiGetEnvelope<InternalLinkEdgeRow[]>(`${base}/internal-links?direction=in&url=${encodedUrl}`)
        .then((r) => r.data)
        .catch(() => [] as InternalLinkEdgeRow[]),
      apiGetEnvelope<InternalLinkEdgeRow[]>(`${base}/internal-links?direction=out&url=${encodedUrl}`)
        .then((r) => r.data)
        .catch(() => [] as InternalLinkEdgeRow[]),
      apiGetEnvelope<Backlink[]>(`/projects/${pid}/backlinks?limit=500`)
        .then((r) => r.data)
        .catch(() => [] as Backlink[]),
      apiGet<WebVitalMetric[]>(`${base}/web-vitals`).catch(() => [] as WebVitalMetric[]),
      apiGetEnvelope<AuditIssueRecord[]>(`${base}/audit-issues?status=all&limit=200`)
        .then((r) => r.data)
        .catch(() => [] as AuditIssueRecord[]),
      apiGetEnvelope<Opportunity[]>(`/projects/${pid}/opportunities?limit=200`)
        .then((r) => r.data)
        .catch(() => [] as Opportunity[]),
      apiGetEnvelope<Keyword[]>(`/projects/${pid}/keywords?limit=200`)
        .then((r) => r.data)
        .catch(() => [] as Keyword[]),
      apiGet<ResolvedSourceAnchor | null>(`/source-map/resolve?url=${encodedUrl}`).catch(() => null)
    ]);

    // GSC aggregation (defensive: filter to the selected URL).
    const gsc = aggregateGsc(Array.isArray(gscRows) ? gscRows : [], selectedUrl);

    // Rankings: keywords mapped to this URL → latest rank snapshot (best-effort).
    const mappedKeywords = (Array.isArray(keywordsAll) ? keywordsAll : []).filter((kw) =>
      urlsMatch(kw.targetUrl, selectedUrl)
    );
    const rankings: RankingRow[] = await Promise.all(
      mappedKeywords.slice(0, 25).map(async (keyword) => {
        const snapshots = await apiGet<RankSnapshot[]>(`/projects/${pid}/keywords/${keyword.id}/rank-snapshots`).catch(
          () => [] as RankSnapshot[]
        );
        const safe = Array.isArray(snapshots) ? snapshots : [];
        return {
          keyword,
          latest: latestRankSnapshot(safe),
          positionTrend: rankPositionTrend(safe)
        };
      })
    );

    // Backlinks pointing AT this URL (filter client-side — no ?targetUrl= server filter).
    const backlinks = (Array.isArray(backlinksAll) ? backlinksAll : []).filter((link) =>
      urlsMatch(link.targetUrl, selectedUrl)
    );

    return {
      ...dashboard,
      selectedSite,
      urlOptions,
      selectedUrl,
      discoveredUrl,
      latestFetch: selectedRow?.latestFetch ?? null,
      latestIndexability: selectedRow?.latestIndexability ?? null,
      fetchHistory: Array.isArray(fetchHistory) ? fetchHistory : [],
      indexabilityHistory: Array.isArray(indexabilityHistory) ? indexabilityHistory : [],
      gsc,
      rankings,
      inlinks: Array.isArray(inlinks) ? inlinks : [],
      outlinks: Array.isArray(outlinks) ? outlinks : [],
      backlinks,
      webVitals: Array.isArray(webVitals) ? webVitals : [],
      issues: (Array.isArray(issuesAll) ? issuesAll : []).filter((issue) => urlsMatch(issue.url, selectedUrl)),
      opportunities: (Array.isArray(opportunitiesAll) ? opportunitiesAll : []).filter((opp) =>
        opp.affectedUrls.some((affected) => urlsMatch(affected, selectedUrl))
      ),
      sourceAnchor: sourceAnchor ?? null
    };
  } catch (error) {
    return {
      ...empty(dashboard, selectedSite, options.url ?? null),
      connected: false,
      errorMessage: error instanceof Error ? error.message : "URL-Dossier konnte nicht geladen werden."
    };
  }
}
