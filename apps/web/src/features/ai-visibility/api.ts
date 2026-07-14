import type { AiAnswerSnapshot, AiPrompt, AeoAssessment, Proposal, ProposalKind, ProposalStatus } from "@seo-tool/domain-model";
import { apiPost } from "../../lib/api-client";

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
