import type { CannibalizationItem, CtrGapItem, Opportunity, OpportunityStatus, StrikingDistanceItem } from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope, apiPost, emptyListMeta, type ListMeta } from "../../lib/api-client";
import { loadFoundationDashboardData, type FoundationDashboardData, type FoundationSite } from "../../lib/foundation-api";

export type { ListMeta };

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = ["open", "planned", "in_progress", "implemented", "validated", "reopened", "dismissed", "expired"];

export interface SearchPerformanceIntelligence {
  capturedAt: string | null;
  strikingDistance: StrikingDistanceItem[];
  ctrGaps: CtrGapItem[];
  cannibalization: CannibalizationItem[];
  summary: { rows: number; strikingDistance: number; ctrGaps: number; cannibalization: number };
}

export interface OpportunityBoardData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  opportunities: Opportunity[];
  opportunitiesMeta: ListMeta;
  statusFilter: string;
  searchPerformance: SearchPerformanceIntelligence | null;
}

export async function loadOpportunityBoard(options: { status?: string } = {}): Promise<OpportunityBoardData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;
  const status = options.status && (OPPORTUNITY_STATUSES as string[]).includes(options.status) ? options.status : "all";

  if (!dashboard.connected || !dashboard.selectedProject) {
    return { ...dashboard, selectedSite, opportunities: [], opportunitiesMeta: emptyListMeta(), statusFilter: status, searchPerformance: null };
  }

  try {
    const params = new URLSearchParams({ limit: "50" });
    if (status !== "all") params.set("status", status);
    const [response, searchPerformance] = await Promise.all([
      apiGetEnvelope<Opportunity[]>(`/projects/${dashboard.selectedProject.id}/opportunities?${params.toString()}`),
      selectedSite
        ? apiGet<SearchPerformanceIntelligence>(`/projects/${dashboard.selectedProject.id}/sites/${selectedSite.id}/search-performance/intelligence`).catch(() => null)
        : Promise.resolve(null)
    ]);
    return {
      ...dashboard,
      selectedSite,
      opportunities: response.data,
      opportunitiesMeta: response.meta ?? emptyListMeta(response.data.length),
      statusFilter: status,
      searchPerformance
    };
  } catch (error) {
    return {
      ...dashboard,
      selectedSite,
      opportunities: [],
      opportunitiesMeta: emptyListMeta(),
      statusFilter: status,
      searchPerformance: null,
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Opportunities konnten nicht geladen werden."
    };
  }
}

export function transitionOpportunity(opportunityId: string, status: OpportunityStatus): Promise<Opportunity> {
  return apiPost<Opportunity>(`/opportunities/${opportunityId}/transition`, { status });
}

export function revalidateOpportunity(opportunityId: string): Promise<Opportunity> {
  return apiPost<Opportunity>(`/opportunities/${opportunityId}/revalidate`, {});
}

export function generateIndexabilityOpportunities(projectId: string, siteId: string): Promise<{ created: number }> {
  return apiPost<{ created: number }>(`/projects/${projectId}/sites/${siteId}/opportunities/generate-indexability`, {});
}

export function generateAllOpportunities(projectId: string, siteId: string): Promise<{ created: number }> {
  return apiPost<{ created: number }>(`/projects/${projectId}/sites/${siteId}/opportunities/generate`, {});
}

export function syncSearchPerformance(projectId: string, siteId: string): Promise<{ inserted: number }> {
  return apiPost<{ inserted: number }>(`/projects/${projectId}/sites/${siteId}/search-performance/sync`, {});
}
