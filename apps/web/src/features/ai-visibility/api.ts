import type { AiAnswerSnapshot, AiPrompt, AiVisibilityScore, AeoAssessment, Proposal, ProposalKind, ProposalStatus } from "@seo-tool/domain-model";
import { apiGet, apiPost } from "../../lib/api-client";
import { loadFoundationDashboardData, type FoundationDashboardData, type FoundationSite } from "../../lib/foundation-api";

export interface AiVisibilityData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  prompts: AiPrompt[];
  visibility: AiVisibilityScore | null;
  aeo: AeoAssessment[];
  proposals: Proposal[];
}

export async function loadAiVisibility(): Promise<AiVisibilityData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;

  if (!dashboard.connected || !dashboard.selectedProject) {
    return { ...dashboard, selectedSite, prompts: [], visibility: null, aeo: [], proposals: [] };
  }

  try {
    const projectId = dashboard.selectedProject.id;
    const [prompts, visibility, aeo, proposals] = await Promise.all([
      apiGet<AiPrompt[]>(`/projects/${projectId}/ai-prompts`),
      apiGet<AiVisibilityScore>(`/projects/${projectId}/ai-visibility`).catch(() => null),
      selectedSite
        ? apiGet<AeoAssessment[]>(`/projects/${projectId}/sites/${selectedSite.id}/aeo`).catch(() => [])
        : Promise.resolve([]),
      apiGet<Proposal[]>(`/projects/${projectId}/proposals`).catch(() => [])
    ]);
    return { ...dashboard, selectedSite, prompts, visibility, aeo, proposals };
  } catch (error) {
    return {
      ...dashboard,
      selectedSite,
      prompts: [],
      visibility: null,
      aeo: [],
      proposals: [],
      connected: false,
      errorMessage: error instanceof Error ? error.message : "AI-Visibility-Daten konnten nicht geladen werden."
    };
  }
}

export function createAiPrompt(projectId: string, prompt: string, market?: string): Promise<AiPrompt> {
  return apiPost<AiPrompt>(`/projects/${projectId}/ai-prompts`, { prompt, market });
}

export function recordAiSnapshot(projectId: string, promptId: string): Promise<AiAnswerSnapshot> {
  return apiPost<AiAnswerSnapshot>(`/projects/${projectId}/ai-prompts/${promptId}/snapshots`, {});
}

export function scanAeo(projectId: string, siteId: string, url: string, content: string): Promise<AeoAssessment> {
  return apiPost<AeoAssessment>(`/projects/${projectId}/sites/${siteId}/aeo/scan`, { url, content });
}

export interface CreateProposalInput {
  kind: ProposalKind;
  title: string;
  body: string;
  opportunityId?: string;
}

export function createProposal(projectId: string, input: CreateProposalInput): Promise<Proposal> {
  return apiPost<Proposal>(`/projects/${projectId}/proposals`, input);
}

export function transitionProposal(proposalId: string, status: ProposalStatus): Promise<Proposal> {
  return apiPost<Proposal>(`/proposals/${proposalId}/transition`, { status });
}
