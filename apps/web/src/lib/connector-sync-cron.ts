import { validateConnectorSyncJobPayload } from "@seo-tool/domain-model";

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiCaller = (method: string, path: string, body?: unknown) => Promise<ApiResponse>;

function unwrap<T>(response: ApiResponse): T {
  return (response.body as { data?: T } | null)?.data as T;
}

function errorMessage(response: ApiResponse, fallback: string): string {
  return (response.body as { error?: { message?: string } } | null)?.error?.message ?? fallback;
}

export interface EnqueueDueConnectorSyncsResult {
  scheduled: number;
  alreadyQueued: number;
  integrations: number;
}

/**
 * Enqueue a connector_sync job for every integration. The job subject is
 * day-scoped (see makeConnectorSyncJobSubject), so re-running on each cron tick
 * collapses to one sync per integration per day instead of piling up.
 */
export async function enqueueDueConnectorSyncs(call: ApiCaller): Promise<EnqueueDueConnectorSyncsResult> {
  const listResponse = await call("GET", "/integrations");
  const integrations = unwrap<Array<{ id: string }>>(listResponse) ?? [];
  let scheduled = 0;
  let alreadyQueued = 0;
  for (const integration of integrations) {
    const response = await call("POST", `/integrations/${integration.id}/sync/schedule`);
    if (response.status === 201) {
      scheduled += 1;
    } else if (response.status === 200) {
      alreadyQueued += 1;
    }
  }
  return { scheduled, alreadyQueued, integrations: integrations.length };
}

export interface DrainConnectorSyncJobsOptions {
  call: ApiCaller;
  maxJobs?: number;
  timeBudgetMs?: number;
  now?: () => number;
}

export interface ConnectorSyncJobOutcome {
  jobId: string;
  integrationId: string;
  status: "succeeded" | "failed";
  metricsInserted?: number;
  error?: string;
}

export interface DrainConnectorSyncJobsResult {
  processed: number;
  stoppedReason: "empty" | "maxJobs" | "timeBudget";
  outcomes: ConnectorSyncJobOutcome[];
}

const DEFAULT_MAX_JOBS = 10;
const DEFAULT_TIME_BUDGET_MS = 40_000;

/**
 * Drains pending connector_sync jobs: claim → run the integration sync → complete.
 * A sync failure marks the job failed (so it can be retried) but does not abort
 * the drain. Bounded by job count and a wall-clock budget for serverless.
 */
export async function drainConnectorSyncJobs(options: DrainConnectorSyncJobsOptions): Promise<DrainConnectorSyncJobsResult> {
  const now = options.now ?? (() => Date.now());
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = now();
  const outcomes: ConnectorSyncJobOutcome[] = [];
  let stoppedReason: DrainConnectorSyncJobsResult["stoppedReason"] = "empty";

  while (true) {
    if (outcomes.length >= maxJobs) {
      stoppedReason = "maxJobs";
      break;
    }
    if (now() - startedAt >= timeBudgetMs) {
      stoppedReason = "timeBudget";
      break;
    }

    const claim = await options.call("POST", "/jobs/claim", { type: "connector_sync" });
    const job = unwrap<{ id: string; payload?: Record<string, unknown> } | null>(claim);
    if (!job) {
      stoppedReason = "empty";
      break;
    }

    let payload: { integrationId: string; siteId?: string };
    try {
      payload = validateConnectorSyncJobPayload(job.payload ?? {});
    } catch (error) {
      await options.call("POST", `/jobs/${job.id}/complete`, { status: "failed", lastError: error instanceof Error ? error.message : "invalid connector_sync payload" });
      outcomes.push({ jobId: job.id, integrationId: "", status: "failed", error: "invalid payload" });
      continue;
    }

    const syncResponse = await options.call("POST", `/integrations/${payload.integrationId}/sync`, payload.siteId ? { siteId: payload.siteId } : {});
    if (syncResponse.status >= 400) {
      const message = errorMessage(syncResponse, `sync failed with ${syncResponse.status}`);
      await options.call("POST", `/jobs/${job.id}/complete`, { status: "failed", lastError: message });
      outcomes.push({ jobId: job.id, integrationId: payload.integrationId, status: "failed", error: message });
      continue;
    }

    const result = unwrap<{ normalizedMetricsInserted?: number }>(syncResponse);
    await options.call("POST", `/jobs/${job.id}/complete`, { status: "succeeded" });
    outcomes.push({ jobId: job.id, integrationId: payload.integrationId, status: "succeeded", metricsInserted: result?.normalizedMetricsInserted });
  }

  return { processed: outcomes.length, stoppedReason, outcomes };
}
