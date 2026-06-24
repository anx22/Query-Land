import { NextResponse, type NextRequest } from "next/server";
import { callInternalApi } from "../../../../lib/server-api";
import { drainCrawlJobs } from "../../../../lib/crawl-cron";

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

  const result = await drainCrawlJobs({
    call: (method, path, body) => callInternalApi(method, path, body)
  });

  return NextResponse.json({ ok: true, ...result });
}
