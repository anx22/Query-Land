import type { Keyword, KeywordGroup, KeywordIntent } from "@seo-tool/domain-model";
import { apiGet, apiGetEnvelope, emptyListMeta, type ListMeta } from "../../lib/api-client";
import { loadFoundationDashboardData, type FoundationDashboardData } from "../../lib/foundation-api";

export type { ListMeta };

export const KEYWORD_INTENT_OPTIONS: KeywordIntent[] = ["informational", "commercial", "transactional", "navigational", "local", "comparison", "problem_solving"];

export interface KeywordLibraryData extends FoundationDashboardData {
  groups: KeywordGroup[];
  keywords: Keyword[];
  keywordsMeta: ListMeta;
  intentFilter: string;
}

export async function loadKeywordLibrary(options: { intent?: string } = {}): Promise<KeywordLibraryData> {
  const dashboard = await loadFoundationDashboardData();
  const intent = options.intent && KEYWORD_INTENT_OPTIONS.includes(options.intent as KeywordIntent) ? options.intent : "all";
  if (!dashboard.connected || !dashboard.selectedProject) {
    return { ...dashboard, groups: [], keywords: [], keywordsMeta: emptyListMeta(), intentFilter: intent };
  }
  try {
    const projectId = dashboard.selectedProject.id;
    const params = new URLSearchParams({ limit: "100" });
    if (intent !== "all") params.set("intent", intent);
    const [groups, keywords] = await Promise.all([
      apiGet<KeywordGroup[]>(`/projects/${projectId}/keyword-groups`),
      apiGetEnvelope<Keyword[]>(`/projects/${projectId}/keywords?${params.toString()}`)
    ]);
    return { ...dashboard, groups, keywords: keywords.data, keywordsMeta: keywords.meta ?? emptyListMeta(keywords.data.length), intentFilter: intent };
  } catch (error) {
    return {
      ...dashboard,
      groups: [],
      keywords: [],
      keywordsMeta: emptyListMeta(),
      intentFilter: intent,
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Keyword-Bibliothek konnte nicht geladen werden."
    };
  }
}
