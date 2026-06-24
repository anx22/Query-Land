import { describe, expect, it } from "vitest";
import { drainCrawlJobs } from "./crawl-cron";
import { InProcessCrawlWorkerApiClient } from "./crawl-worker-client";

interface ApiResponse {
  status: number;
  body: unknown;
}

// A minimal in-memory API double. We only drive the non-crawl_seed job path so the
// crawl cycle completes without any network I/O (claim -> completeJob -> done).
function makeCaller(jobsToHandOut: Array<{ id: string; type: string }>) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const queue = [...jobsToHandOut];
  const caller = async (method: string, path: string, body?: unknown): Promise<ApiResponse> => {
    calls.push({ method, path, body });
    if (path === "/jobs/claim") {
      const next = queue.shift() ?? null;
      return { status: 200, body: { data: next } };
    }
    if (/^\/jobs\/[^/]+\/complete$/.test(path)) {
      return { status: 200, body: { data: { status: "succeeded" } } };
    }
    return { status: 404, body: { error: { message: `unexpected ${path}` } } };
  };
  return { caller, calls };
}

describe("drainCrawlJobs", () => {
  it("returns empty when no jobs are queued", async () => {
    const { caller, calls } = makeCaller([]);
    const result = await drainCrawlJobs({ call: caller });
    expect(result.processed).toBe(0);
    expect(result.stoppedReason).toBe("empty");
    expect(calls).toHaveLength(1); // one claim, returned null
  });

  it("processes queued jobs until the queue drains", async () => {
    const { caller, calls } = makeCaller([
      { id: "j1", type: "noop" },
      { id: "j2", type: "noop" }
    ]);
    const result = await drainCrawlJobs({ call: caller });
    expect(result.processed).toBe(2);
    expect(result.stoppedReason).toBe("empty");
    // each job: one complete call; plus claims (3 = 2 jobs + 1 empty)
    expect(calls.filter((c) => c.path === "/jobs/claim")).toHaveLength(3);
    expect(calls.filter((c) => /\/complete$/.test(c.path))).toHaveLength(2);
  });

  it("stops at maxJobs before draining the queue", async () => {
    const { caller } = makeCaller([
      { id: "j1", type: "noop" },
      { id: "j2", type: "noop" },
      { id: "j3", type: "noop" }
    ]);
    const result = await drainCrawlJobs({ call: caller, maxJobs: 2 });
    expect(result.processed).toBe(2);
    expect(result.stoppedReason).toBe("maxJobs");
  });

  it("stops when the time budget is exceeded without claiming", async () => {
    const { caller, calls } = makeCaller([{ id: "j1", type: "noop" }]);
    let t = 0;
    const result = await drainCrawlJobs({
      call: caller,
      timeBudgetMs: 100,
      now: () => {
        const value = t;
        t += 200; // first read 0, second read 200 -> over budget
        return value;
      }
    });
    expect(result.processed).toBe(0);
    expect(result.stoppedReason).toBe("timeBudget");
    expect(calls).toHaveLength(0);
  });
});

describe("InProcessCrawlWorkerApiClient", () => {
  it("unwraps the data envelope", async () => {
    const client = new InProcessCrawlWorkerApiClient(async () => ({ status: 200, body: { data: { id: "run-1" } } }));
    await expect(client.createCrawlRun("p", "s", "manual")).resolves.toEqual({ id: "run-1" });
  });

  it("throws the API error message on non-2xx", async () => {
    const client = new InProcessCrawlWorkerApiClient(async () => ({ status: 422, body: { error: { message: "bad input" } } }));
    await expect(client.computeHealthScore("p", "s")).rejects.toThrow("bad input");
  });
});
