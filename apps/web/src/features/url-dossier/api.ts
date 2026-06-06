import type { AuditIssueRecord, DiscoveredUrl, IndexabilityRecord, Opportunity, UrlFetchRecord } from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope } from "../../lib/api-client";
import { loadFoundationDashboardData, type FoundationDashboardData, type FoundationSite } from "../../lib/foundation-api";

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

interface UrlExplorerRow {
  discoveredUrl: DiscoveredUrl;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
}

export interface UrlDossierData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  urlOptions: string[];
  selectedUrl: string | null;
  discoveredUrl: DiscoveredUrl | null;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
  fetchHistory: UrlFetchRecord[];
  indexabilityHistory: IndexabilityRecord[];
  inlinks: InternalLinkEdgeRow[];
  outlinks: InternalLinkEdgeRow[];
  issues: AuditIssueRecord[];
  opportunities: Opportunity[];
  sourceAnchor: ResolvedSourceAnchor | null;
}

function empty(dashboard: FoundationDashboardData, selectedSite: FoundationSite | null, selectedUrl: string | null, urlOptions: string[] = []): UrlDossierData {
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
    inlinks: [],
    outlinks: [],
    issues: [],
    opportunities: [],
    sourceAnchor: null
  };
}

export async function loadUrlDossier(options: { url?: string } = {}): Promise<UrlDossierData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;
  if (!dashboard.connected || !dashboard.selectedProject || !selectedSite) {
    return empty(dashboard, selectedSite, options.url ?? null);
  }

  const projectId = dashboard.selectedProject.id;
  const siteId = selectedSite.id;
  const base = `/projects/${projectId}/sites/${siteId}`;

  try {
    const explorer = (await apiGetEnvelope<UrlExplorerRow[]>(`${base}/url-explorer?limit=50`)).data;
    const urlOptions = explorer.map((row) => row.discoveredUrl.normalizedUrl);
    const selectedUrl = options.url && urlOptions.includes(options.url) ? options.url : (urlOptions[0] ?? null);
    if (!selectedUrl) {
      return empty(dashboard, selectedSite, null, urlOptions);
    }
    const selectedRow = explorer.find((row) => row.discoveredUrl.normalizedUrl === selectedUrl) ?? null;
    const discoveredUrl = selectedRow?.discoveredUrl ?? null;

    const [fetchHistory, indexabilityHistory, inlinks, outlinks, issuesAll, opportunitiesAll, sourceAnchor] = await Promise.all([
      discoveredUrl ? apiGet<UrlFetchRecord[]>(`${base}/discovered-urls/${discoveredUrl.id}/fetch-results`).catch(() => []) : Promise.resolve([]),
      discoveredUrl ? apiGet<IndexabilityRecord[]>(`${base}/discovered-urls/${discoveredUrl.id}/indexability`).catch(() => []) : Promise.resolve([]),
      apiGetEnvelope<InternalLinkEdgeRow[]>(`${base}/internal-links?direction=in&url=${encodeURIComponent(selectedUrl)}`).then((r) => r.data).catch(() => []),
      apiGetEnvelope<InternalLinkEdgeRow[]>(`${base}/internal-links?direction=out&url=${encodeURIComponent(selectedUrl)}`).then((r) => r.data).catch(() => []),
      apiGetEnvelope<AuditIssueRecord[]>(`${base}/audit-issues?status=all&limit=100`).then((r) => r.data).catch(() => []),
      apiGetEnvelope<Opportunity[]>(`/projects/${projectId}/opportunities?limit=100`).then((r) => r.data).catch(() => []),
      apiGet<ResolvedSourceAnchor | null>(`/source-map/resolve?url=${encodeURIComponent(selectedUrl)}`).catch(() => null)
    ]);

    return {
      ...dashboard,
      selectedSite,
      urlOptions,
      selectedUrl,
      discoveredUrl,
      latestFetch: selectedRow?.latestFetch ?? null,
      latestIndexability: selectedRow?.latestIndexability ?? null,
      fetchHistory,
      indexabilityHistory,
      inlinks,
      outlinks,
      issues: issuesAll.filter((issue) => issue.url === selectedUrl),
      opportunities: opportunitiesAll.filter((opp) => opp.affectedUrls.includes(selectedUrl)),
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
