/**
 * Maintenance cron — processors for the two previously-orphan job types (accepted by the API but
 * never produced or drained). Both are now real, scheduled features:
 *   - health_check: enqueued daily per site → recompute the crawl health score (a fresh health
 *     snapshot even on days without a full crawl).
 *   - source_map_refresh: enqueued when a deploy marker lands → re-crawl the project's sites so the
 *     audit reflects the freshly deployed templates (the §4.3 "deploy → re-crawl" trigger).
 */

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiCaller = (method: string, path: string, body?: unknown) => Promise<ApiResponse>;

function unwrap<T>(response: ApiResponse): T {
  return (response.body as { data?: T } | null)?.data as T;
}

export interface EnqueueDueHealthChecksResult {
  scheduled: number;
  alreadyQueued: number;
  sites: number;
}

/** Enqueue a day-scoped health_check per site (idempotent per site per day). */
export async function enqueueDueHealthChecks(call: ApiCaller, options: { today?: string } = {}): Promise<EnqueueDueHealthChecksResult> {
  const day = options.today ?? new Date().toISOString().slice(0, 10);
  const projects = unwrap<Array<{ id: string }>>(await call("GET", "/projects")) ?? [];
  let scheduled = 0;
  let alreadyQueued = 0;
  let sites = 0;
  for (const project of projects) {
    const projectSites = unwrap<Array<{ id: string }>>(await call("GET", `/projects/${project.id}/sites`)) ?? [];
    sites += projectSites.length;
    for (const site of projectSites) {
      const response = await call("POST", "/jobs", {
        projectId: project.id,
        type: "health_check",
        subject: `${site.id}:${day}`,
        payload: { siteId: site.id },
      });
      if (response.status === 201) scheduled += 1;
      else if (response.status === 200) alreadyQueued += 1;
    }
  }
  return { scheduled, alreadyQueued, sites };
}

export interface EvaluateAllWebVitalsResult {
  sites: number;
  issuesCreated: number;
  issuesResolved: number;
}

/** Evaluate Core Web Vitals into audit issues for every site (run after PSI syncs populate metrics). */
export async function evaluateAllWebVitals(call: ApiCaller): Promise<EvaluateAllWebVitalsResult> {
  const projects = unwrap<Array<{ id: string }>>(await call("GET", "/projects")) ?? [];
  let sites = 0;
  let issuesCreated = 0;
  let issuesResolved = 0;
  for (const project of projects) {
    const projectSites = unwrap<Array<{ id: string }>>(await call("GET", `/projects/${project.id}/sites`)) ?? [];
    for (const site of projectSites) {
      const res = await call("POST", `/projects/${project.id}/sites/${site.id}/web-vitals/evaluate`);
      if (res.status >= 400) continue;
      sites += 1;
      const result = unwrap<{ created?: number; resolved?: number }>(res);
      issuesCreated += result?.created ?? 0;
      issuesResolved += result?.resolved ?? 0;
    }
  }
  return { sites, issuesCreated, issuesResolved };
}

export interface DrainMaintenanceJobsResult {
  healthChecks: number;
  sourceMapRefreshes: number;
  recrawlsScheduled: number;
  stoppedReason: "empty" | "maxJobs" | "timeBudget";
}

const DEFAULT_MAX_JOBS = 50;
const DEFAULT_TIME_BUDGET_MS = 25_000;

/** Drain health_check + source_map_refresh jobs. Interleaves both types until neither has work. */
export async function drainMaintenanceJobs(options: { call: ApiCaller; now?: () => number; maxJobs?: number; timeBudgetMs?: number }): Promise<DrainMaintenanceJobsResult> {
  const now = options.now ?? (() => Date.now());
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = now();
  let processed = 0;
  let healthChecks = 0;
  let sourceMapRefreshes = 0;
  let recrawlsScheduled = 0;
  let stoppedReason: DrainMaintenanceJobsResult["stoppedReason"] = "empty";

  const complete = (jobId: string, lastError?: string) =>
    options.call("POST", `/jobs/${jobId}/complete`, { status: lastError ? "failed" : "succeeded", ...(lastError ? { lastError } : {}) });

  while (true) {
    if (processed >= maxJobs) { stoppedReason = "maxJobs"; break; }
    if (now() - startedAt >= timeBudgetMs) { stoppedReason = "timeBudget"; break; }

    const health = unwrap<{ id: string; projectId: string; payload?: Record<string, unknown> } | null>(await options.call("POST", "/jobs/claim", { type: "health_check" }));
    if (health) {
      const siteId = typeof health.payload?.siteId === "string" ? health.payload.siteId : null;
      if (siteId) {
        const res = await options.call("POST", `/projects/${health.projectId}/sites/${siteId}/health-scores/compute`, {});
        await complete(health.id, res.status >= 400 ? `health compute ${res.status}` : undefined);
        if (res.status < 400) healthChecks += 1;
      } else {
        await complete(health.id, "missing siteId");
      }
      processed += 1;
      continue;
    }

    const refresh = unwrap<{ id: string; projectId: string } | null>(await options.call("POST", "/jobs/claim", { type: "source_map_refresh" }));
    if (refresh) {
      // A deploy landed → re-crawl every site of the project so the audit reflects the new templates.
      const sites = unwrap<Array<{ id: string; baseUrl: string }>>(await options.call("GET", `/projects/${refresh.projectId}/sites`)) ?? [];
      for (const site of sites) {
        const res = await options.call("POST", `/projects/${refresh.projectId}/sites/${site.id}/crawl-runs/schedule`, { trigger: "deploy", baseUrl: site.baseUrl });
        if (res.status < 400) recrawlsScheduled += 1;
      }
      await complete(refresh.id);
      sourceMapRefreshes += 1;
      processed += 1;
      continue;
    }

    stoppedReason = "empty";
    break;
  }

  return { healthChecks, sourceMapRefreshes, recrawlsScheduled, stoppedReason };
}
