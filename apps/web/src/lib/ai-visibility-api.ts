/**
 * ai-visibility-api.ts — server-only, defensive loader for the AI Visibility
 * screen (UX module 6 / spec §4.12, table §J).
 *
 * SERVER ONLY: imports api-client (which lazy-imports the Node-only internal
 * API). A "use client" island must NEVER import this module as a value — it
 * would drag node:fs/crypto into the browser bundle and break `next build`.
 * Client islands receive plain serializable props instead. Pure helpers for the
 * islands live in features/ai-visibility/ai-logic.ts (API-free).
 *
 * Each network request is wrapped so a single failure (or empty DB at build
 * time) degrades to an empty value instead of crashing the page.
 *
 * Confidence: AI-Visibility / citation data is Class E (LLM interpretation) —
 * a signal, NEVER evidence. AEO is Class A (deterministic, content-derived).
 */

import type {
  AeoAssessment,
  AiAnswerSnapshot,
  AiPrompt,
  AiVisibilityScore,
  Proposal,
} from "@seo-tool/domain-model";
import { isAiProviderConfigured } from "@seo-tool/api";
import { apiBaseUrl, apiGet } from "./api-client";
import {
  loadFoundationDashboardData,
  type FoundationDashboardData,
  type FoundationSite,
} from "./foundation-api";

/** One prompt plus its most recent answer snapshot (citation matrix row). */
export interface CitationRow {
  prompt: AiPrompt;
  /** Most recent snapshot for this prompt, or null if none captured yet. */
  latest: AiAnswerSnapshot | null;
  /** Total snapshots captured for this prompt. */
  snapshotCount: number;
}

export interface AiVisibilityOverview extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  prompts: AiPrompt[];
  /** Citation matrix rows — prompts × latest cited-status. */
  citationRows: CitationRow[];
  visibility: AiVisibilityScore | null;
  aeo: AeoAssessment[];
  proposals: Proposal[];
  /** Whether a real LLM answer-provider is wired. While false, citation numbers are placeholders, not measurements. */
  aiConfigured: boolean;
}

function emptyOverview(
  dashboard: FoundationDashboardData,
  selectedSite: FoundationSite | null,
  overrides: Partial<AiVisibilityOverview> = {},
): AiVisibilityOverview {
  return {
    ...dashboard,
    selectedSite,
    prompts: [],
    citationRows: [],
    visibility: null,
    aeo: [],
    proposals: [],
    aiConfigured: isAiProviderConfigured(),
    ...overrides,
  };
}

/** Defensive GET — resolves to `fallback` on any error (never throws). */
async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

/**
 * Load the full AI Visibility overview. Foundation data drives project/site
 * selection (projects[0]); every AI request is independently defensive so the
 * page renders graceful empty-states even against an empty DB.
 */
export async function loadAiVisibilityOverview(): Promise<AiVisibilityOverview> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;

  if (!dashboard.connected || !dashboard.selectedProject) {
    return emptyOverview(dashboard, selectedSite);
  }

  const projectId = dashboard.selectedProject.id;

  const [prompts, visibility, aeo, proposals] = await Promise.all([
    safeGet<AiPrompt[]>(`/projects/${projectId}/ai-prompts`, []),
    safeGet<AiVisibilityScore | null>(`/projects/${projectId}/ai-visibility`, null),
    selectedSite
      ? safeGet<AeoAssessment[]>(`/projects/${projectId}/sites/${selectedSite.id}/aeo`, [])
      : Promise.resolve<AeoAssessment[]>([]),
    safeGet<Proposal[]>(`/projects/${projectId}/proposals`, []),
  ]);

  // Build the citation matrix: one row per prompt with its latest snapshot.
  const citationRows = await Promise.all(
    prompts.map(async (prompt): Promise<CitationRow> => {
      const snapshots = await safeGet<AiAnswerSnapshot[]>(
        `/projects/${projectId}/ai-prompts/${prompt.id}/snapshots`,
        [],
      );
      const sorted = [...snapshots].sort(
        (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
      );
      return { prompt, latest: sorted[0] ?? null, snapshotCount: snapshots.length };
    }),
  );

  return emptyOverview(dashboard, selectedSite, {
    prompts,
    citationRows,
    visibility,
    aeo,
    proposals,
  });
}

export { apiBaseUrl };
