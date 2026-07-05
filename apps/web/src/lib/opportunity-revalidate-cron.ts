/**
 * Opportunity revalidation cron (§6.5/§2.10). Two halves, mirroring the connector-sync cron:
 *   - enqueueDueOpportunityRevalidations: for every opportunity currently in `implemented`, enqueue a
 *     day-scoped opportunity_revalidate job (idempotent per opportunity per day). GSC evidence has
 *     3–14 day latency, so an implemented opportunity is re-checked daily until fresh evidence flips
 *     it to validated/reopened.
 *   - drainOpportunityRevalidations: claim each job → POST /opportunities/:id/revalidate → complete.
 *
 * A 409 (the opportunity already left `implemented`) is treated as done, not a failure.
 */

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

export interface EnqueueDueOpportunityRevalidationsResult {
  scheduled: number;
  alreadyQueued: number;
  implemented: number;
}

export async function enqueueDueOpportunityRevalidations(
  call: ApiCaller,
  options: { today?: string } = {},
): Promise<EnqueueDueOpportunityRevalidationsResult> {
  const day = options.today ?? new Date().toISOString().slice(0, 10);
  const projects = unwrap<Array<{ id: string }>>(await call("GET", "/projects")) ?? [];
  let scheduled = 0;
  let alreadyQueued = 0;
  let implemented = 0;
  for (const project of projects) {
    const listed = unwrap<Array<{ id: string }>>(await call("GET", `/projects/${project.id}/opportunities?status=implemented&pageSize=200`)) ?? [];
    implemented += listed.length;
    for (const opportunity of listed) {
      const response = await call("POST", "/jobs", {
        projectId: project.id,
        type: "opportunity_revalidate",
        subject: `${opportunity.id}:${day}`,
        payload: { opportunityId: opportunity.id },
      });
      if (response.status === 201) scheduled += 1;
      else if (response.status === 200) alreadyQueued += 1;
    }
  }
  return { scheduled, alreadyQueued, implemented };
}

export interface DrainOpportunityRevalidationsResult {
  processed: number;
  validated: number;
  reopened: number;
  pending: number;
  stoppedReason: "empty" | "maxJobs" | "timeBudget";
}

const DEFAULT_MAX_JOBS = 50;
const DEFAULT_TIME_BUDGET_MS = 30_000;

export async function drainOpportunityRevalidations(options: {
  call: ApiCaller;
  now?: () => number;
  maxJobs?: number;
  timeBudgetMs?: number;
}): Promise<DrainOpportunityRevalidationsResult> {
  const now = options.now ?? (() => Date.now());
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = now();
  let processed = 0;
  let validated = 0;
  let reopened = 0;
  let pending = 0;
  let stoppedReason: DrainOpportunityRevalidationsResult["stoppedReason"] = "empty";

  while (true) {
    if (processed >= maxJobs) {
      stoppedReason = "maxJobs";
      break;
    }
    if (now() - startedAt >= timeBudgetMs) {
      stoppedReason = "timeBudget";
      break;
    }

    const job = unwrap<{ id: string; payload?: Record<string, unknown> } | null>(await options.call("POST", "/jobs/claim", { type: "opportunity_revalidate" }));
    if (!job) {
      stoppedReason = "empty";
      break;
    }

    const opportunityId = typeof job.payload?.opportunityId === "string" ? job.payload.opportunityId : null;
    if (!opportunityId) {
      await options.call("POST", `/jobs/${job.id}/complete`, { status: "failed", lastError: "missing opportunityId" });
      processed += 1;
      continue;
    }

    const res = await options.call("POST", `/opportunities/${opportunityId}/revalidate`);
    if (res.status >= 400) {
      // 409 (already left `implemented`) or any other error: complete the job so it does not retry
      // forever; a real re-check will be re-enqueued next day for still-implemented opportunities.
      await options.call("POST", `/jobs/${job.id}/complete`, { status: "succeeded", lastError: errorMessage(res, `revalidate ${res.status}`) });
      processed += 1;
      continue;
    }

    const opportunity = unwrap<{ status: string }>(res);
    if (opportunity?.status === "validated") validated += 1;
    else if (opportunity?.status === "reopened") reopened += 1;
    else pending += 1; // stayed `implemented` (no fresh evidence yet) — re-enqueued next cycle.

    await options.call("POST", `/jobs/${job.id}/complete`, { status: "succeeded" });
    processed += 1;
  }

  return { processed, validated, reopened, pending, stoppedReason };
}
