/**
 * keywords-api.ts — server-side data loader for the Keywords & Rankings screen (UX, Teil 3 §F).
 *
 * SERVER-ONLY: imports api-client (which lazy-imports server-api → node:fs/crypto).
 * A "use client" island must NEVER import this module as a value — it would drag
 * Node built-ins into the browser bundle and break `next build`. Pure helpers a
 * client island needs live in features/keyword-rank/keyword-logic.ts instead.
 *
 * Loads everything the screen needs, defensively: each request catches its own
 * error → empty value, so an empty DB (build time) renders empty-states, never a crash.
 *
 * Data-source mapping (per spec §F, verified routes):
 *   PositionDistribution → /projects/{pid}/keywords/{kwId}/rank-snapshots aggregated
 *                          over all keywords (latest snapshot per keyword).
 *                          No "all rank-snapshots" endpoint → fan-out, capped at 50
 *                          keywords (mirrors overview-api).
 *   TrendChart           → /projects/{pid}/visibility (VisibilityScore[], sort by computedAt)
 *   Keyword table        → /projects/{pid}/keywords (+ rank-snapshot history per keyword for
 *                          Sparkline + DeltaChip)
 *   Inspector            → rank history + /projects/{pid}/keywords/{kwId}/serp-snapshots
 *                          + /projects/{pid}/keywords/{kwId}/serp-diff (loaded eagerly,
 *                          serialised into props — drawer is a pure island).
 *   Clusters / Filter    → /projects/{pid}/keyword-groups
 */

import type {
  Keyword,
  KeywordGroup,
  RankSnapshot,
  SerpDiff,
  SerpSnapshot,
  VisibilityScore,
} from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope } from "./api-client";
import { loadFoundationDashboardData, type FoundationProject } from "./foundation-api";
import {
  buildKeywordRow,
  emptyBuckets,
  positionToBucket,
  type KeywordInspectorData,
  type KeywordRow,
  type PositionBuckets,
  type RankPoint,
} from "../features/keyword-rank/keyword-logic";
import type { TrendDataPoint } from "./overview-api";

// Cap on rank-snapshot fan-out (mirrors overview-api). Keeps build/load bounded.
const RANK_FANOUT_CAP = 50;

export type { PositionBuckets, KeywordRow, RankPoint, KeywordInspectorData };

export interface KeywordsRankData {
  connected: boolean;
  errorMessage?: string;
  apiBaseUrl: string;

  project: FoundationProject | null;

  /** Clusters for FilterBar + add form. */
  groups: KeywordGroup[];

  /** Fully-resolved table rows (plain serialisable objects for client islands). */
  rows: KeywordRow[];
  /** Total keyword count reported by the API (may exceed rows.length when capped). */
  totalKeywords: number;

  /** Aggregated position buckets for the PositionDistribution histogram. */
  buckets: PositionBuckets;

  /** Visibility trend for the TrendChart. */
  visibilityTrend: TrendDataPoint[];
  latestVisibility: VisibilityScore | null;
  previousVisibility: VisibilityScore | null;

  /** Per-keyword Inspector data (rank history + SERP), keyed by keyword id. */
  inspectors: Record<string, KeywordInspectorData>;
}

function emptyData(
  project: FoundationProject | null,
  apiBaseUrl: string,
  opts: { connected: boolean; errorMessage?: string }
): KeywordsRankData {
  return {
    ...opts,
    apiBaseUrl,
    project,
    groups: [],
    rows: [],
    totalKeywords: 0,
    buckets: emptyBuckets(),
    visibilityTrend: [],
    latestVisibility: null,
    previousVisibility: null,
    inspectors: {},
  };
}

export async function loadKeywordsRankData(): Promise<KeywordsRankData> {
  const dashboard = await loadFoundationDashboardData();
  const project = dashboard.selectedProject;

  if (!dashboard.connected || !project) {
    return emptyData(project, dashboard.apiBaseUrl, {
      connected: dashboard.connected,
      errorMessage: dashboard.errorMessage,
    });
  }

  const pid = project.id;

  // Top-level requests in parallel, each catching its own error.
  const [groups, keywordsEnv, visibilityScores] = await Promise.all([
    apiGet<KeywordGroup[]>(`/projects/${pid}/keyword-groups`).catch(() => [] as KeywordGroup[]),
    apiGetEnvelope<Keyword[]>(`/projects/${pid}/keywords?limit=100`)
      .catch(() => ({ data: [] as Keyword[], meta: undefined })),
    apiGet<VisibilityScore[]>(`/projects/${pid}/visibility`).catch(() => [] as VisibilityScore[]),
  ]);

  const keywords = Array.isArray(keywordsEnv.data) ? keywordsEnv.data : [];
  const totalKeywords = keywordsEnv.meta?.total ?? keywords.length;

  // --- Visibility trend (sort by computedAt ascending) ---
  const sortedVisibility = [...(Array.isArray(visibilityScores) ? visibilityScores : [])].sort(
    (a, b) => a.computedAt.localeCompare(b.computedAt)
  );
  const visibilityTrend: TrendDataPoint[] = sortedVisibility.map((v) => ({
    label: new Date(v.computedAt).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }),
    value: v.score,
  }));
  const latestVisibility = sortedVisibility[sortedVisibility.length - 1] ?? null;
  const previousVisibility =
    sortedVisibility.length >= 2 ? sortedVisibility[sortedVisibility.length - 2] : null;

  // --- Rank-snapshot fan-out (capped) for sparklines, deltas, buckets, inspector ---
  const trackedKeywords = keywords.slice(0, RANK_FANOUT_CAP);
  const rankResults = await Promise.allSettled(
    trackedKeywords.map(async (kw): Promise<{ keyword: Keyword; snapshots: RankSnapshot[] }> => {
      const snapshots = await apiGet<RankSnapshot[]>(
        `/projects/${pid}/keywords/${kw.id}/rank-snapshots`
      ).catch(() => [] as RankSnapshot[]);
      return { keyword: kw, snapshots: Array.isArray(snapshots) ? snapshots : [] };
    })
  );

  const buckets = emptyBuckets();
  const rows: KeywordRow[] = [];

  // Keywords beyond the cap still appear in the table (without rank history).
  const beyondCap = keywords.slice(RANK_FANOUT_CAP);

  for (const result of rankResults) {
    if (result.status !== "fulfilled") continue;
    const { keyword, snapshots } = result.value;
    const row = buildKeywordRow(keyword, snapshots);
    rows.push(row);
    if (row.currentPosition != null) {
      const bucket = positionToBucket(row.currentPosition);
      if (bucket) {
        buckets[bucket]++;
        buckets.total++;
      }
    }
  }
  for (const keyword of beyondCap) {
    rows.push(buildKeywordRow(keyword, []));
  }

  // --- Inspector data (SERP) for the tracked keywords ---
  const serpResults = await Promise.allSettled(
    trackedKeywords.map(async (kw): Promise<KeywordInspectorData> => {
      const [serpSnapshots, serpDiff] = await Promise.all([
        apiGet<SerpSnapshot[]>(`/projects/${pid}/keywords/${kw.id}/serp-snapshots`).catch(
          () => [] as SerpSnapshot[]
        ),
        apiGet<SerpDiff>(`/projects/${pid}/keywords/${kw.id}/serp-diff`).catch(() => null),
      ]);
      const row = rows.find((r) => r.id === kw.id);
      return {
        keywordId: kw.id,
        rankHistory: row?.rankHistory ?? [],
        serpSnapshots: Array.isArray(serpSnapshots) ? serpSnapshots : [],
        serpDiff: serpDiff ?? null,
      };
    })
  );

  const inspectors: Record<string, KeywordInspectorData> = {};
  for (const result of serpResults) {
    if (result.status !== "fulfilled") continue;
    inspectors[result.value.keywordId] = result.value;
    // Attach the latest SERP features to the matching table row (chips per §F).
    const latestSerp = [...result.value.serpSnapshots].sort((a, b) =>
      b.capturedAt.localeCompare(a.capturedAt)
    )[0];
    if (latestSerp && Array.isArray(latestSerp.serpFeatures)) {
      const row = rows.find((r) => r.id === result.value.keywordId);
      if (row) row.serpFeatures = latestSerp.serpFeatures;
    }
  }

  return {
    connected: true,
    apiBaseUrl: dashboard.apiBaseUrl,
    project,
    groups: Array.isArray(groups) ? groups : [],
    rows,
    totalKeywords,
    buckets,
    visibilityTrend,
    latestVisibility,
    previousVisibility,
    inspectors,
  };
}
