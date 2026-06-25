/**
 * board-api.ts — server-side data loader for the Opportunity Board (UX-5).
 *
 * Loads opportunities from the verified envelope endpoint
 *   /projects/{pid}/opportunities
 * defensively: any error returns an empty, non-crashing board so the client
 * islands render graceful empty-states instead of throwing (the DB is empty at
 * build time).
 *
 * Pure helpers (labels, filtering, kanban mapping, confidence→level) live in
 * board-logic.ts — API-free so client islands can import them without dragging
 * the Node-only internal API into the browser bundle. Re-exported here so
 * server code and tests keep a single import surface.
 */

import type { Opportunity } from "@seo-tool/domain-model";
import { apiGetEnvelope, emptyListMeta, type ListMeta } from "./api-client";
import { loadFoundationDashboardData, type FoundationProject, type FoundationSite } from "./foundation-api";
import { computeReadiness } from "./readiness";

export * from "./board-logic";

// ---------------------------------------------------------------------------
// Board data shape
// ---------------------------------------------------------------------------

export interface OpportunityBoardData {
  apiBaseUrl: string;
  connected: boolean;
  errorMessage?: string;
  selectedProject: FoundationProject | null;
  selectedSite: FoundationSite | null;
  /** Whether the active project has run a crawl — opportunities are generated from crawl data. */
  hasCrawl: boolean;
  opportunities: Opportunity[];
  meta: ListMeta;
}

// ---------------------------------------------------------------------------
// Loader (defensive — never throws)
// ---------------------------------------------------------------------------

export async function loadOpportunityBoard(): Promise<OpportunityBoardData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.selectedSite ?? dashboard.sites[0] ?? null;
  const readiness = computeReadiness({
    projects: dashboard.projects,
    selectedProject: dashboard.selectedProject,
    sites: dashboard.sites,
    integrations: dashboard.integrations,
    jobs: dashboard.jobs,
  });

  const base = {
    apiBaseUrl: dashboard.apiBaseUrl,
    selectedProject: dashboard.selectedProject,
    selectedSite,
    hasCrawl: readiness.hasCrawl,
  };

  if (!dashboard.connected || !dashboard.selectedProject) {
    return {
      ...base,
      connected: dashboard.connected,
      errorMessage: dashboard.errorMessage,
      opportunities: [],
      meta: emptyListMeta(),
    };
  }

  try {
    // Load all opportunities (no status filter — filtering is client-side, 0-backend).
    const response = await apiGetEnvelope<Opportunity[]>(
      `/projects/${dashboard.selectedProject.id}/opportunities?limit=200`
    );
    const opportunities = Array.isArray(response.data) ? response.data : [];
    return {
      ...base,
      connected: true,
      opportunities,
      meta: response.meta ?? emptyListMeta(opportunities.length),
    };
  } catch (error) {
    return {
      ...base,
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Opportunities konnten nicht geladen werden.",
      opportunities: [],
      meta: emptyListMeta(),
    };
  }
}
