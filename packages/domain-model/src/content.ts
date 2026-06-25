// Content Workspace (UX-7, refresh-centric). The brief is a MANUAL, editable artifact —
// there is NO LLM auto-generation here. Metrics are deterministic, demo-tagged stubs; real
// GSC data flows in later via the connector contract. These types + pure helpers are
// DB-independent so they can be unit-tested in isolation.

import type { SourceConfidence } from "./integrations.js";

// Lifecycle of an editable content brief. draft -> ready -> in_progress -> done; dismiss from
// any non-terminal state. Mirrors the opportunity/proposal review discipline elsewhere.
export type ContentRecommendationStatus = "draft" | "ready" | "in_progress" | "done" | "dismissed";

export const CONTENT_RECOMMENDATION_STATUSES: readonly ContentRecommendationStatus[] = [
  "draft",
  "ready",
  "in_progress",
  "done",
  "dismissed"
];

// Search intent classification for the target page. Kept deliberately small + explicit.
export type ContentIntent = "informational" | "commercial" | "transactional" | "navigational";

export const CONTENT_INTENTS: readonly ContentIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "navigational"
];

// A single term-coverage checklist entry (the "terms" brief field). Editorial uses this to
// confirm a target term is actually present in the refreshed copy.
export interface ContentTerm {
  term: string;
  done: boolean;
}

// An internal-link suggestion attached to a brief (derived from the real crawl link graph).
export interface ContentInternalLink {
  url: string;
  anchor: string | null;
  // Why the link was suggested (e.g. "hub page links to siblings"). Human-readable, deterministic.
  reason: string;
}

// The editable brief itself. target_queries / sections / terms / internal_links are JSON in the
// store; here they are first-class arrays.
export interface ContentRecommendation {
  id: string;
  projectId: string;
  siteId: string;
  url: string;
  // Optional FK back to the opportunity that motivated this brief (board drill-down).
  opportunityId: string | null;
  title: string;
  targetTopic: string;
  targetQueries: string[];
  intent: ContentIntent;
  sections: string[];
  terms: ContentTerm[];
  internalLinks: ContentInternalLink[];
  validationMetric: string;
  status: ContentRecommendationStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Time-series point used for decay/refresh detection. source_confidence reflects where the
// measured value came from (e.g. "A"/"B" once a real connector backfills rows).
export type PageMetricName = "clicks" | "impressions" | "position" | "ctr";

export const PAGE_METRIC_NAMES: readonly PageMetricName[] = ["clicks", "impressions", "position", "ctr"];

export interface PageMetric {
  id: string;
  projectId: string;
  siteId: string;
  url: string;
  metric: PageMetricName;
  value: number;
  capturedAt: string;
  // Where the value came from; real connectors write "A"/"B" etc.
  sourceConfidence: SourceConfidence;
}

// A URL that looks like it is decaying and is a candidate for a content refresh.
export interface RefreshCandidate {
  url: string;
  // Negative = declining clicks over the window (the decay signal).
  clicksTrend: number;
  // Most recent clicks value, for context.
  latestClicks: number;
  openIssues: number;
  // 0..100 deterministic ranking score; higher = more worth refreshing.
  refreshScore: number;
  reasons: string[];
}

// Deterministic content score for a single URL: blends crawl health, open issues and metric trend.
export interface ContentScore {
  url: string;
  score: number;
  healthScore: number;
  openIssues: number;
  metricTrend: number;
  reasons: string[];
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// Pure: deterministic content score for a URL. Starts from the site health score, subtracts a
// penalty per open issue, and shifts by the metric trend (declining clicks lower the score).
// Bounded to 0..100. Same inputs always yield the same score (no time/random dependence).
export function computeContentScore(
  healthScore: number,
  openIssues: number,
  metricTrend: number
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const base = clamp(healthScore, 0, 100);

  const issuePenalty = clamp(openIssues, 0, 100) * 5;
  if (openIssues > 0) {
    reasons.push(`${openIssues} open issue(s) (-${issuePenalty})`);
  }

  // Declining clicks (negative trend) reduce the score; growth nudges it up. Scaled and bounded
  // so a single noisy data point can't dominate.
  const trendAdjustment = clamp(Math.round(metricTrend / 2), -20, 20);
  if (metricTrend < 0) {
    reasons.push(`declining clicks trend (${trendAdjustment})`);
  } else if (metricTrend > 0) {
    reasons.push(`growing clicks trend (+${trendAdjustment})`);
  }

  if (reasons.length === 0) {
    reasons.push("stable — no negative signals");
  }

  const score = clamp(Math.round(base - issuePenalty + trendAdjustment), 0, 100);
  return { score, reasons };
}

export interface RefreshCandidateInput {
  url: string;
  clicksTrend: number;
  latestClicks: number;
  openIssues: number;
}

export interface RankRefreshCandidatesOptions {
  limit?: number;
}

// Pure: rank refresh candidates deterministically. A candidate is "decaying" when its clicks
// trend is negative; the steeper the decline, the more traffic at stake and the more open issues,
// the higher the refreshScore. Stable tie-break by url so output order is reproducible.
export function rankRefreshCandidates(
  inputs: RefreshCandidateInput[],
  options: RankRefreshCandidatesOptions = {}
): RefreshCandidate[] {
  const candidates: RefreshCandidate[] = [];
  for (const input of inputs) {
    // Only declining pages are refresh candidates.
    if (!(input.clicksTrend < 0)) continue;

    const reasons: string[] = [];
    const decline = Math.abs(input.clicksTrend);
    // Steepness of decline (0..50): scaled by both the absolute drop and the prior traffic level.
    const declineScore = clamp(Math.round(decline / 5), 0, 50);
    reasons.push(`clicks declined by ${decline} over the window`);

    // Traffic at stake (0..30): a decaying high-traffic page is worth more than a tiny one.
    const trafficScore = clamp(Math.round(input.latestClicks / 20), 0, 30);
    if (input.latestClicks > 0) {
      reasons.push(`${input.latestClicks} recent clicks still at stake`);
    }

    // Open issues compound the case for a refresh (0..20).
    const issueScore = clamp(input.openIssues * 5, 0, 20);
    if (input.openIssues > 0) {
      reasons.push(`${input.openIssues} open issue(s) on this URL`);
    }

    const refreshScore = clamp(declineScore + trafficScore + issueScore, 0, 100);
    candidates.push({
      url: input.url,
      clicksTrend: input.clicksTrend,
      latestClicks: input.latestClicks,
      openIssues: input.openIssues,
      refreshScore,
      reasons
    });
  }

  candidates.sort((left, right) => right.refreshScore - left.refreshScore || left.url.localeCompare(right.url));
  return typeof options.limit === "number" ? candidates.slice(0, Math.max(0, options.limit)) : candidates;
}
