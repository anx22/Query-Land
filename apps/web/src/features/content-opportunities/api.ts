import type { Opportunity, OpportunityStatus } from "@seo-tool/domain-model";
import { apiGetEnvelope, apiPost, emptyListMeta, type ListMeta } from "../../lib/api-client";
import { loadFoundationDashboardData, type FoundationDashboardData, type FoundationSite } from "../../lib/foundation-api";

export type { ListMeta };

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = ["open", "planned", "in_progress", "implemented", "validated", "reopened", "dismissed", "expired"];

export interface OpportunityBoardData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  opportunities: Opportunity[];
  opportunitiesMeta: ListMeta;
  statusFilter: string;
}

export async function loadOpportunityBoard(options: { status?: string } = {}): Promise<OpportunityBoardData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;
  const status = options.status && (OPPORTUNITY_STATUSES as string[]).includes(options.status) ? options.status : "all";

  if (!dashboard.connected || !dashboard.selectedProject) {
    return { ...dashboard, selectedSite, opportunities: [], opportunitiesMeta: emptyListMeta(), statusFilter: status };
  }

  try {
    const params = new URLSearchParams({ limit: "50" });
    if (status !== "all") params.set("status", status);
    const response = await apiGetEnvelope<Opportunity[]>(`/projects/${dashboard.selectedProject.id}/opportunities?${params.toString()}`);
    return {
      ...dashboard,
      selectedSite,
      opportunities: response.data,
      opportunitiesMeta: response.meta ?? emptyListMeta(response.data.length),
      statusFilter: status
    };
  } catch (error) {
    return {
      ...dashboard,
      selectedSite,
      opportunities: [],
      opportunitiesMeta: emptyListMeta(),
      statusFilter: status,
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
