/**
 * backlinks-api.ts — server-side data loader for the Backlinks screen (UX-4 §H).
 *
 * Loads everything the Backlinks screen needs from real API endpoints. Each
 * request catches its own errors → null / empty array, so the screen renders
 * graceful empty-states on an empty DB and never crashes `next build`.
 *
 * IMPORTANT (Node-in-client-bundle trap): this module imports the internal
 * api-client (server-only). Client islands must NEVER import it as a value;
 * they receive plain serialisable props and import pure helpers from
 * `features/backlinks/backlinks-logic.ts` instead.
 *
 * Data-source mapping (per spec §H / VERIFIED endpoints):
 *   TrendChart (Backlinks/Ref-Domains)  → /projects/{pid}/backlink-snapshots
 *   New vs. Lost (diverging bars)        → /projects/{pid}/backlinks/diff
 *   Distribution (Follow/Nofollow,Anchor)→ /projects/{pid}/authority (followRatio, topAnchors)
 *   ScoreGauge (Follow-Ratio)            → /projects/{pid}/authority (followRatio)
 *   Ref-domains table                    → /projects/{pid}/referring-domains
 *
 * Data gaps (backend backlog): per-domain history (no per-row sparkline source),
 * Domain-Rating / authority score (3rd-party = 🔭), new/lost over time (diff is
 * latest-pair only). See final report.
 */

import type {
  AuthoritySummary,
  BacklinkDiff,
  BacklinkSnapshot,
  ReferringDomain,
} from "@seo-tool/domain-model";
import { apiGet } from "./api-client";
import { loadFoundationDashboardData, type FoundationDashboardData } from "./foundation-api";

export interface BacklinksScreenData extends FoundationDashboardData {
  /** Authority summary (follow-ratio, top anchors, top ref-domains, top targets). */
  authority: AuthoritySummary | null;
  /** Full referring-domains list (for the table). */
  referringDomains: ReferringDomain[];
  /** Latest new/lost diff (null when fewer than two snapshots). */
  diff: BacklinkDiff | null;
  /** Snapshot history (for the trend chart), unsorted as returned. */
  snapshots: BacklinkSnapshot[];
}

function emptyScreen(dashboard: FoundationDashboardData): BacklinksScreenData {
  return { ...dashboard, authority: null, referringDomains: [], diff: null, snapshots: [] };
}

export async function loadBacklinksScreenData(): Promise<BacklinksScreenData> {
  const dashboard = await loadFoundationDashboardData();

  if (!dashboard.connected || !dashboard.selectedProject) {
    return emptyScreen(dashboard);
  }

  const pid = dashboard.selectedProject.id;

  const [authority, referringDomains, diff, snapshots] = await Promise.all([
    apiGet<AuthoritySummary>(`/projects/${pid}/authority`).catch(() => null),
    apiGet<ReferringDomain[]>(`/projects/${pid}/referring-domains`).catch(() => [] as ReferringDomain[]),
    apiGet<BacklinkDiff>(`/projects/${pid}/backlinks/diff`).catch(() => null),
    apiGet<BacklinkSnapshot[]>(`/projects/${pid}/backlink-snapshots`).catch(() => [] as BacklinkSnapshot[]),
  ]);

  return {
    ...dashboard,
    authority,
    referringDomains: Array.isArray(referringDomains) ? referringDomains : [],
    diff,
    snapshots: Array.isArray(snapshots) ? snapshots : [],
  };
}
