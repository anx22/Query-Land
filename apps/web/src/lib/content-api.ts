/**
 * content-api.ts — server-side data loader for the Content Workspace (UX7-W2).
 *
 * Loads everything the Content-Workspace screen needs from the site-scoped
 * content endpoints (UX7-W1). Each request is defensive: any error → empty
 * result so the page never crashes on an empty DB / offline API. The selected
 * URL (?url=) drives the score gauge + internal-link suggestions; the status
 * filter (?status=) scopes the brief list.
 *
 * Data-source honesty: refresh candidates + page metrics + the content score
 * are deterministic, demo-tagged stubs (no GSC connector yet). The UI marks
 * these with ConfidenceBadge level "E". Briefs themselves are real, persisted
 * editorial artifacts.
 *
 * Mirrors lib/audit-api.ts (loadTechnicalAuditOverview using
 * loadFoundationDashboardData for the active project/site).
 */

import type {
  ContentInternalLink,
  ContentRecommendation,
  ContentScore,
  RefreshCandidate,
} from "@seo-tool/domain-model";
import { CONTENT_RECOMMENDATION_STATUSES } from "@seo-tool/domain-model";
import { apiGet } from "./api-client";
import { loadFoundationDashboardData, type FoundationProject, type FoundationSite } from "./foundation-api";
import { resolveBriefStatusFilter, type BriefStatusFilter } from "../features/content-workspace/brief-form";

export interface ContentWorkspaceData {
  connected: boolean;
  errorMessage?: string;
  apiBaseUrl: string;

  project: FoundationProject | null;
  site: FoundationSite | null;

  /** Refresh candidates (decaying URLs), demo-tagged. */
  refreshCandidates: RefreshCandidate[];

  /** The URL currently selected (?url=), or null. */
  selectedUrl: string | null;
  /** Content score for the selected URL, or null when none selected/derivable. */
  contentScore: ContentScore | null;
  /** Internal-link suggestions for the selected URL (real crawl link graph). */
  internalLinkSuggestions: ContentInternalLink[];

  /** Briefs in the active status filter, newest first. */
  briefs: ContentRecommendation[];
  /** Active brief-list status filter. */
  activeStatus: BriefStatusFilter;

  /** The brief currently open in the editor (?briefId=), or null. */
  selectedBrief: ContentRecommendation | null;
}

const REFRESH_LIMIT = 25;

function emptyData(
  project: FoundationProject | null,
  site: FoundationSite | null,
  opts: { connected: boolean; errorMessage?: string; apiBaseUrl: string; activeStatus: BriefStatusFilter; selectedUrl: string | null }
): ContentWorkspaceData {
  return {
    connected: opts.connected,
    errorMessage: opts.errorMessage,
    apiBaseUrl: opts.apiBaseUrl,
    project,
    site,
    refreshCandidates: [],
    selectedUrl: opts.selectedUrl,
    contentScore: null,
    internalLinkSuggestions: [],
    briefs: [],
    activeStatus: opts.activeStatus,
    selectedBrief: null,
  };
}

export async function loadContentWorkspace(
  options: {
    url?: string;
    status?: string;
    briefId?: string;
  } = {}
): Promise<ContentWorkspaceData> {
  const dashboard = await loadFoundationDashboardData();
  const project = dashboard.selectedProject;
  const site = dashboard.selectedSite ?? dashboard.sites[0] ?? null;
  const apiBaseUrl = dashboard.apiBaseUrl;
  const activeStatus = resolveBriefStatusFilter(options.status);
  const selectedUrl = options.url && options.url.trim() !== "" ? options.url.trim() : null;

  if (!dashboard.connected || !project || !site) {
    return emptyData(project, site, {
      connected: dashboard.connected,
      errorMessage: dashboard.errorMessage,
      apiBaseUrl,
      activeStatus,
      selectedUrl,
    });
  }

  const base = `/projects/${project.id}/sites/${site.id}`;

  const briefQuery = activeStatus === "all" ? "" : `?status=${encodeURIComponent(activeStatus)}`;

  const [refreshCandidates, briefs] = await Promise.all([
    apiGet<RefreshCandidate[]>(`${base}/refresh-candidates?limit=${REFRESH_LIMIT}`).catch(
      () => [] as RefreshCandidate[]
    ),
    apiGet<ContentRecommendation[]>(`${base}/content-recommendations${briefQuery}`).catch(
      () => [] as ContentRecommendation[]
    ),
  ]);

  // Default the selected URL to the top refresh candidate so the gauge + link
  // suggestions are populated on first load (no blank panels).
  const effectiveUrl =
    selectedUrl ?? (Array.isArray(refreshCandidates) && refreshCandidates[0] ? refreshCandidates[0].url : null);

  const [contentScore, internalLinkSuggestions] = effectiveUrl
    ? await Promise.all([
        apiGet<ContentScore>(`${base}/content-score?url=${encodeURIComponent(effectiveUrl)}`).catch(
          () => null
        ),
        apiGet<ContentInternalLink[]>(
          `${base}/internal-link-suggestions?url=${encodeURIComponent(effectiveUrl)}`
        ).catch(() => [] as ContentInternalLink[]),
      ])
    : [null, [] as ContentInternalLink[]];

  // Resolve the brief open in the editor. Prefer it from the already-loaded
  // list; only fetch it standalone when it is outside the active filter.
  let selectedBrief: ContentRecommendation | null = null;
  if (options.briefId) {
    selectedBrief = briefs.find((b) => b.id === options.briefId) ?? null;
    if (!selectedBrief) {
      selectedBrief = await apiGet<ContentRecommendation>(
        `/content-recommendations/${options.briefId}`
      ).catch(() => null);
    }
  }

  const sortedBriefs = [...(Array.isArray(briefs) ? briefs : [])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );

  return {
    connected: true,
    apiBaseUrl,
    project,
    site,
    refreshCandidates: Array.isArray(refreshCandidates) ? refreshCandidates : [],
    selectedUrl: effectiveUrl,
    contentScore: contentScore ?? null,
    internalLinkSuggestions: Array.isArray(internalLinkSuggestions) ? internalLinkSuggestions : [],
    briefs: sortedBriefs,
    activeStatus,
    selectedBrief,
  };
}

/** Re-export for callers that build the status filter chips. */
export { CONTENT_RECOMMENDATION_STATUSES };
