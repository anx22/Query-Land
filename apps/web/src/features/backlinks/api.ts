import { apiGetEnvelope, apiPost, emptyListMeta, type ListMeta } from "../../lib/api-client";

export type { ListMeta };

export function importBacklinks(projectId: string): Promise<{ snapshotId: string }> {
  return apiPost<{ snapshotId: string }>(`/projects/${projectId}/backlinks/import`, {});
}

// Re-export for convenience
export { emptyListMeta, apiGetEnvelope };
