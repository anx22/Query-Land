/**
 * spike-visibility.ts — server-side data loader for the UX-0 chart spike.
 *
 * Loads the first project's backlink snapshot history and maps it to a
 * plain serialisable array understood by VisibilitySpikeChart.
 *
 * Empty / error handling:
 *   - No projects → returns [].
 *   - API unreachable / empty snapshots → returns [].
 *   - Any thrown error is caught and returns [].
 *
 * This keeps the server component (spike/page.tsx) free of try/catch and
 * satisfies the DoD empty-state requirement without crashing the build.
 */

import type { BacklinkSnapshot } from "@seo-tool/domain-model";
import { apiGet } from "./api-client";
import type { FoundationProject } from "./foundation-api";
import type { VisibilityDataPoint } from "../components/charts/visibility-spike-chart";

// Re-export the type so page.tsx can annotate without a second import path.
export type { VisibilityDataPoint };

/**
 * Fetches backlink snapshots for the first available project and maps each
 * snapshot to { label: formatted date, value: totalBacklinks }.
 *
 * @returns Chronologically ordered array (oldest first). Empty array on any failure.
 */
export async function loadSpikeVisibility(): Promise<VisibilityDataPoint[]> {
  try {
    const projects = await apiGet<FoundationProject[]>("/projects");
    const project = projects[0];
    if (!project) return [];

    const snapshots = await apiGet<BacklinkSnapshot[]>(
      `/projects/${project.id}/backlink-snapshots`
    );

    if (!Array.isArray(snapshots) || snapshots.length === 0) return [];

    // Sort chronologically (the API may return newest-first).
    const sorted = [...snapshots].sort((a, b) =>
      a.capturedAt.localeCompare(b.capturedAt)
    );

    return sorted.map((snap): VisibilityDataPoint => ({
      // Short date label for the X axis (e.g. "15.5." in German locale).
      label: new Date(snap.capturedAt).toLocaleDateString("de-DE", {
        day: "numeric",
        month: "numeric",
      }),
      // totalBacklinks is the primary time-series value for backlink trend charts.
      value: snap.totalBacklinks,
    }));
  } catch {
    // Silently return empty array; the chart island will render the empty state.
    return [];
  }
}
