import { NextResponse, type NextRequest } from "next/server";
import { callInternalApi } from "../../../../lib/server-api";
import { drainCrawlJobs } from "../../../../lib/crawl-cron";
import { drainConnectorSyncJobs, enqueueDueConnectorSyncs } from "../../../../lib/connector-sync-cron";
import { runGscRefreshAll } from "../../../../lib/gsc-refresh";
import { runDueReportSchedules } from "../../../../lib/reports-cron";
import { drainOpportunityRevalidations, enqueueDueOpportunityRevalidations } from "../../../../lib/opportunity-revalidate-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Crawl cycles fetch external URLs; give the function room (Pro: up to 300s,
// Hobby caps this to its plan limit automatically).
export const maxDuration = 60;

/**
 * Scheduled crawl-queue drainer. On Vercel there is no long-running worker, so a
 * cron job (see vercel.json) hits this endpoint to process pending crawl_seed
 * jobs against the embedded API + Neon database.
 *
 * Security: requires CRON_SECRET. Vercel automatically sends it as
 * `Authorization: Bearer <CRON_SECRET>` for cron invocations. Without the secret
 * the endpoint is inert on Vercel (503) so it can never be an open crawl trigger.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Invalid or missing cron secret" } },
        { status: 401 }
      );
    }
  } else if (process.env.VERCEL) {
    return NextResponse.json(
      { error: { code: "cron_not_configured", message: "Set CRON_SECRET to enable the scheduled crawl worker." } },
      { status: 503 }
    );
  }

  const call = (method: string, path: string, body?: unknown) => callInternalApi(method, path, body);

  // Opt-in resumable crawling (migrations 016/017): when CRAWL_RESUMABLE=1, each
  // cycle processes a time-bounded frontier batch and enqueues a continuation job
  // for large sites. Unset → the classic single-invocation in-memory crawl.
  const cycleTimeBudgetMs = process.env.CRAWL_RESUMABLE === "1" ? 45_000 : undefined;
  const crawl = await drainCrawlJobs({ call, cycleTimeBudgetMs });
  // Refresh connector data: enqueue one sync per integration per day, then drain.
  const enqueued = await enqueueDueConnectorSyncs(call);
  const connectors = await drainConnectorSyncJobs({ call });
  // Pull the rest of the GSC data paths (search-performance, rank/visibility, index status) for every
  // connected project. skipConnectorSync: the drain above already ran the aggregate connector sync.
  const gsc = await runGscRefreshAll(call, { skipConnectorSync: true });
  // Drive the async opportunity-validation loop (§6.5): re-enqueue a re-check for every implemented
  // opportunity, then drain the revalidation jobs (flip to validated/reopened once evidence lands).
  const revalEnqueued = await enqueueDueOpportunityRevalidations(call);
  const revalidations = await drainOpportunityRevalidations({ call });
  // Generate + deliver any report schedules that have fallen due.
  const reports = await runDueReportSchedules(call);

  return NextResponse.json({ ok: true, crawl, connectors: { ...connectors, enqueued }, gsc, revalidations: { ...revalidations, enqueued: revalEnqueued }, reports });
}
