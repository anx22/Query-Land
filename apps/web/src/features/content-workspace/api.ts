import type { ContentRecommendation } from "@seo-tool/domain-model";
import { apiGet, apiPost } from "../../lib/api-client";

// Mutating Content-Workspace operations used by the server actions (UX7-W2).
// The read path lives in lib/content-api.ts (loadContentWorkspace).

export interface CreateBriefInput {
  url: string;
  opportunityId?: string | null;
  title: string;
  targetTopic?: string;
  targetQueries?: string[];
  intent?: ContentRecommendation["intent"];
  sections?: string[];
  terms?: ContentRecommendation["terms"];
  internalLinks?: ContentRecommendation["internalLinks"];
  validationMetric?: string;
  notes?: string;
}

export type UpdateBriefInput = Partial<Omit<CreateBriefInput, "url">>;

export async function createBrief(
  projectId: string,
  siteId: string,
  input: CreateBriefInput
): Promise<ContentRecommendation> {
  return apiPost<ContentRecommendation>(
    `/projects/${projectId}/sites/${siteId}/content-recommendations`,
    input
  );
}

export async function getBrief(recommendationId: string): Promise<ContentRecommendation> {
  return apiGet<ContentRecommendation>(`/content-recommendations/${recommendationId}`);
}

export async function updateBrief(
  recommendationId: string,
  input: UpdateBriefInput
): Promise<ContentRecommendation> {
  // PATCH via the internal proxy: api-client only exposes GET/POST, but the
  // internal callInternalApi handles any method. Use it directly for PATCH.
  const { callInternalApi } = await import("../../lib/server-api");
  const response = await callInternalApi("PATCH", `/content-recommendations/${recommendationId}`, input);
  if (response.status < 200 || response.status >= 300) {
    const payload = response.body as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? `PATCH content-recommendation failed with ${response.status}`);
  }
  const payload = response.body as { data?: ContentRecommendation } | ContentRecommendation;
  return (payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: ContentRecommendation }).data
    : (payload as ContentRecommendation));
}

export async function transitionBrief(
  recommendationId: string,
  status: ContentRecommendation["status"]
): Promise<ContentRecommendation> {
  return apiPost<ContentRecommendation>(
    `/content-recommendations/${recommendationId}/transition`,
    { status }
  );
}

export async function createProposalFromBrief(
  recommendationId: string,
  kind: "dev_ticket" | "fix_pr"
): Promise<{ proposal: unknown; recommendation: ContentRecommendation }> {
  return apiPost<{ proposal: unknown; recommendation: ContentRecommendation }>(
    `/content-recommendations/${recommendationId}/create-proposal`,
    { kind }
  );
}
