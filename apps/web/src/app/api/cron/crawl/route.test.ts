import { afterEach, describe, expect, it, vi } from "vitest";

// Isolate the handler from the real API/DB + cron drains.
vi.mock("../../../../lib/server-api", () => ({ callInternalApi: vi.fn() }));
vi.mock("../../../../lib/crawl-cron", () => ({ drainCrawlJobs: vi.fn(async () => ({ processed: 0 })) }));
vi.mock("../../../../lib/connector-sync-cron", () => ({
  enqueueDueConnectorSyncs: vi.fn(async () => 0),
  drainConnectorSyncJobs: vi.fn(async () => ({ processed: 0 })),
}));
vi.mock("../../../../lib/reports-cron", () => ({ runDueReportSchedules: vi.fn(async () => ({ delivered: 0 })) }));
vi.mock("../../../../lib/gsc-refresh", () => ({ runGscRefreshAll: vi.fn(async () => ({ refreshed: 0 })) }));

import { NextRequest } from "next/server";
import { GET } from "./route";

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/crawl", { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/cron/crawl", () => {
  it("runs and returns ok when no CRON_SECRET and not on Vercel (local dev)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL", "");
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("returns 401 when CRON_SECRET is set but the Authorization header is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req({ authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("returns 200 with the correct Bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("returns 503 on Vercel without a CRON_SECRET (never an open crawl trigger)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL", "1");
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("cron_not_configured");
  });
});
