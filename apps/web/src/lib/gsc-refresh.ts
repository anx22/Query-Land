/**
 * Unified GSC refresh: pulls every GSC-derived data path for a connected project in one pass, so the
 * screens that read them actually fill. Called from three triggers — the OAuth callback (immediate
 * first sync after connecting), the "Jetzt synchronisieren" settings button, and the daily cron.
 *
 * Each step is best-effort: a single source failing (e.g. no tracked keywords yet) must not abort the
 * rest. The three data paths GSC feeds:
 *   1. connector sync            → normalized_metrics (aggregate site metrics)
 *   2. search-performance sync   → search_performance_rows (query×page; feeds opportunities + content)
 *   3. rank-snapshots refresh    → rank_snapshots/serp_snapshots (+ visibility) for tracked keywords
 *   4. url-inspection sync       → url_index_status (Technical Audit "indexed" funnel stage)
 */

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiCaller = (method: string, path: string, body?: unknown) => Promise<ApiResponse>;

function unwrap<T>(response: ApiResponse): T | undefined {
  return (response.body as { data?: T } | null)?.data;
}

export interface GscRefreshResult {
  project: string;
  connected: boolean;
  searchPerformanceRows: number;
  rankKeywords: number;
  urlsInspected: number;
  steps: Array<{ step: string; ok: boolean; detail?: string }>;
}

/** Find the connected GSC integration id for a project, or null. */
async function connectedGscIntegrationId(call: ApiCaller, projectId: string): Promise<string | null> {
  const response = await call("GET", "/integrations");
  const integrations = unwrap<Array<{ id: string; provider: string; projectId?: string; status?: string }>>(response) ?? [];
  const match = integrations.find(
    (integration) => integration.provider === "gsc" && integration.projectId === projectId && integration.status === "connected"
  );
  return match?.id ?? null;
}

async function primarySiteId(call: ApiCaller, projectId: string): Promise<string | null> {
  const response = await call("GET", `/projects/${projectId}/sites`);
  const sites = unwrap<Array<{ id: string }>>(response) ?? [];
  return sites[0]?.id ?? null;
}

/**
 * Run the full GSC refresh for one project. Tolerant per step; returns a per-step report.
 * Returns `connected: false` (and skips the data pulls) when the project has no connected GSC.
 */
export async function runGscRefreshForProject(
  call: ApiCaller,
  projectId: string,
  options: { skipConnectorSync?: boolean; skipUrlInspection?: boolean } = {}
): Promise<GscRefreshResult> {
  const result: GscRefreshResult = {
    project: projectId,
    connected: false,
    searchPerformanceRows: 0,
    rankKeywords: 0,
    urlsInspected: 0,
    steps: []
  };

  const integrationId = await connectedGscIntegrationId(call, projectId);
  if (!integrationId) {
    result.steps.push({ step: "connected", ok: false, detail: "no connected GSC integration" });
    return result;
  }
  result.connected = true;

  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
      result.steps.push({ step: name, ok: true });
    } catch (error) {
      result.steps.push({ step: name, ok: false, detail: error instanceof Error ? error.message : "failed" });
    }
  };

  // 1. Aggregate connector sync (normalized_metrics). Skipped from the cron, where the connector-sync
  //    drain already ran it — avoids writing a duplicate aggregate row per day.
  if (!options.skipConnectorSync) {
    await step("connector_sync", async () => {
      const response = await call("POST", `/integrations/${integrationId}/sync`, {});
      if (response.status >= 400) throw new Error(`sync ${response.status}`);
    });
  }

  const siteId = await primarySiteId(call, projectId);

  // 2. Search-performance (query×page) — needs a site.
  if (siteId) {
    await step("search_performance", async () => {
      const response = await call("POST", `/projects/${projectId}/sites/${siteId}/search-performance/sync`, {});
      if (response.status >= 400) throw new Error(`search-performance ${response.status}`);
      const data = unwrap<{ inserted?: number }>(response);
      result.searchPerformanceRows = data?.inserted ?? 0;
    });
    // 4. URL inspection (index status) — quota-bounded inside the store. Skipped from the OAuth
    //    callback (it loops many URLs and could exceed the redirect handler's time budget); the cron
    //    and the manual "sync now" button run it.
    if (!options.skipUrlInspection) {
      await step("url_inspection", async () => {
        const response = await call("POST", `/projects/${projectId}/sites/${siteId}/url-inspection/sync`, {});
        if (response.status >= 400) throw new Error(`url-inspection ${response.status}`);
        const data = unwrap<{ inspected?: number }>(response);
        result.urlsInspected = data?.inspected ?? 0;
      });
    }
  } else {
    result.steps.push({ step: "search_performance", ok: false, detail: "no site" });
  }

  // 3. Rank snapshots for all tracked keywords, then recompute visibility.
  await step("rank_snapshots", async () => {
    const response = await call("POST", `/projects/${projectId}/rank-snapshots/refresh`, {});
    if (response.status >= 400) throw new Error(`rank-refresh ${response.status}`);
    const data = unwrap<{ recorded?: number }>(response);
    result.rankKeywords = data?.recorded ?? 0;
  });
  await step("visibility", async () => {
    const response = await call("POST", `/projects/${projectId}/visibility/compute`, {});
    if (response.status >= 400) throw new Error(`visibility ${response.status}`);
  });

  return result;
}

/** Run the GSC refresh for every project that has a connected GSC integration (used by the cron). */
export async function runGscRefreshAll(call: ApiCaller, options: { skipConnectorSync?: boolean } = {}): Promise<GscRefreshResult[]> {
  const response = await call("GET", "/integrations");
  const integrations = unwrap<Array<{ provider: string; projectId?: string; status?: string }>>(response) ?? [];
  const projectIds = [
    ...new Set(
      integrations
        .filter((integration) => integration.provider === "gsc" && integration.status === "connected" && integration.projectId)
        .map((integration) => integration.projectId as string)
    )
  ];
  const results: GscRefreshResult[] = [];
  for (const projectId of projectIds) {
    results.push(await runGscRefreshForProject(call, projectId, options));
  }
  return results;
}
