import type { AuthoritySummary, BacklinkDiff, BacklinkSnapshot, ReferringDomain } from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope, apiPost, emptyListMeta, type ListMeta } from "../../lib/api-client";
import { loadFoundationDashboardData, type FoundationDashboardData } from "../../lib/foundation-api";

export type { ListMeta };

export interface BacklinkAuthorityData extends FoundationDashboardData {
  authority: AuthoritySummary | null;
  referringDomains: ReferringDomain[];
  diff: BacklinkDiff | null;
  snapshots: BacklinkSnapshot[];
}

export async function loadBacklinkAuthority(): Promise<BacklinkAuthorityData> {
  const dashboard = await loadFoundationDashboardData();

  if (!dashboard.connected || !dashboard.selectedProject) {
    return { ...dashboard, authority: null, referringDomains: [], diff: null, snapshots: [] };
  }

  try {
    const projectId = dashboard.selectedProject.id;
    const [authority, referringDomains, diff, snapshots] = await Promise.all([
      apiGet<AuthoritySummary>(`/projects/${projectId}/authority`).catch(() => null),
      apiGet<ReferringDomain[]>(`/projects/${projectId}/referring-domains`).catch(() => []),
      apiGet<BacklinkDiff>(`/projects/${projectId}/backlinks/diff`).catch(() => null),
      apiGet<BacklinkSnapshot[]>(`/projects/${projectId}/backlink-snapshots`).catch(() => [])
    ]);
    return { ...dashboard, authority, referringDomains, diff, snapshots };
  } catch (error) {
    return {
      ...dashboard,
      authority: null,
      referringDomains: [],
      diff: null,
      snapshots: [],
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Backlink-Daten konnten nicht geladen werden."
    };
  }
}

export function importBacklinks(projectId: string): Promise<{ snapshotId: string }> {
  return apiPost<{ snapshotId: string }>(`/projects/${projectId}/backlinks/import`, {});
}

// Re-export for convenience
export { emptyListMeta, apiGetEnvelope };
