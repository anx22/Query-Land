import { runCrawlWorkerCycle, type CrawlWorkerCycleResult } from "@seo-tool/crawler";
import { InProcessCrawlWorkerApiClient } from "./crawl-worker-client";

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiCaller = (method: string, path: string, body?: unknown) => Promise<ApiResponse>;

export interface DrainCrawlJobsOptions {
  call: ApiCaller;
  /** Maximum jobs to process in one invocation (keeps within the function timeout). */
  maxJobs?: number;
  /** Wall-clock budget in ms; stop claiming new jobs once exceeded. */
  timeBudgetMs?: number;
  now?: () => number;
  fetchTimeoutMs?: number;
  fetchMaxAttempts?: number;
}

export type DrainStopReason = "empty" | "maxJobs" | "timeBudget";

export interface DrainCrawlJobsResult {
  processed: number;
  stoppedReason: DrainStopReason;
  cycles: CrawlWorkerCycleResult[];
}

const DEFAULT_MAX_JOBS = 5;
const DEFAULT_TIME_BUDGET_MS = 50_000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_FETCH_MAX_ATTEMPTS = 2;

/**
 * Drains pending crawl_seed jobs from the embedded queue, bounded by a job count
 * and a wall-clock budget so it fits inside a serverless function invocation.
 * Replaces the long-running poll loop (services/crawler/src/worker.ts) on Vercel,
 * where the scheduled cron function (app/api/cron/crawl) calls this each tick.
 */
export async function drainCrawlJobs(options: DrainCrawlJobsOptions): Promise<DrainCrawlJobsResult> {
  const client = new InProcessCrawlWorkerApiClient(options.call);
  const now = options.now ?? (() => Date.now());
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = now();
  const cycles: CrawlWorkerCycleResult[] = [];
  let stoppedReason: DrainStopReason = "empty";

  while (true) {
    if (cycles.length >= maxJobs) {
      stoppedReason = "maxJobs";
      break;
    }
    if (now() - startedAt >= timeBudgetMs) {
      stoppedReason = "timeBudget";
      break;
    }
    const result = await runCrawlWorkerCycle({
      apiClient: client,
      fetchTimeoutMs: options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
      retry: { maxAttempts: options.fetchMaxAttempts ?? DEFAULT_FETCH_MAX_ATTEMPTS, delayMs: 100 },
      maxRedirects: 5
    });
    if (!result.claimed) {
      stoppedReason = "empty";
      break;
    }
    cycles.push(result);
    // Structured per-cycle log correlating the drained job to its crawl run, so
    // a scheduled invocation is traceable in serverless logs (no daemon log).
    // Matches the JSON style in services/crawler/src/worker.ts.
    logCrawlCycle({
      jobId: result.jobId,
      crawlRunId: result.crawlRunId,
      outcome: result.status,
      discoveredUrls: result.discoveredUrls,
      fetchedUrls: result.fetchedUrls,
      issues: result.issues,
      errorMessage: result.errorMessage,
      processed: cycles.length
    });
  }

  return { processed: cycles.length, stoppedReason, cycles };
}

/**
 * Emits one structured JSON line per drained crawl cycle so a Vercel cron
 * invocation can be correlated by jobId + crawlRunId. Suppressed under tests to
 * keep CI output clean and deterministic.
 */
function logCrawlCycle(fields: {
  jobId?: string;
  crawlRunId?: string;
  outcome?: string;
  discoveredUrls?: number;
  fetchedUrls?: number;
  issues?: number;
  errorMessage?: string;
  processed: number;
}): void {
  if (process.env.NODE_ENV === "test") return;
  console.log(JSON.stringify({ level: "info", service: "crawl-cron", event: "crawl_drain_cycle", ...fields }));
}
