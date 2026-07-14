import type { Opportunity, OpportunityStatus } from "@seo-tool/domain-model";
import { apiPost } from "../../lib/api-client";

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
