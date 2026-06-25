import { describe, expect, it } from "vitest";
import { drainConnectorSyncJobs, enqueueDueConnectorSyncs } from "./connector-sync-cron";

interface ApiResponse {
  status: number;
  body: unknown;
}

describe("enqueueDueConnectorSyncs", () => {
  it("schedules one sync per integration and reports duplicates", async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const caller = async (method: string, path: string): Promise<ApiResponse> => {
      calls.push({ method, path });
      if (path === "/integrations") {
        return { status: 200, body: { data: [{ id: "int-1" }, { id: "int-2" }] } };
      }
      // int-1 newly scheduled, int-2 already queued today
      return { status: path.includes("int-1") ? 201 : 200, body: { data: { id: "job" } } };
    };
    const result = await enqueueDueConnectorSyncs(caller);
    expect(result).toEqual({ scheduled: 1, alreadyQueued: 1, integrations: 2 });
    expect(calls.filter((c) => c.path.endsWith("/sync/schedule"))).toHaveLength(2);
  });

  it("does nothing when there are no integrations", async () => {
    const caller = async (): Promise<ApiResponse> => ({ status: 200, body: { data: [] } });
    expect(await enqueueDueConnectorSyncs(caller)).toEqual({ scheduled: 0, alreadyQueued: 0, integrations: 0 });
  });
});

describe("drainConnectorSyncJobs", () => {
  function makeCaller(jobs: Array<{ id: string; payload: Record<string, unknown> }>, syncStatus = 200) {
    const queue = [...jobs];
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const caller = async (method: string, path: string, body?: unknown): Promise<ApiResponse> => {
      calls.push({ method, path, body });
      if (path === "/jobs/claim") {
        return { status: 200, body: { data: queue.shift() ?? null } };
      }
      if (/\/integrations\/.+\/sync$/.test(path)) {
        return syncStatus >= 400
          ? { status: syncStatus, body: { error: { message: "quota exceeded" } } }
          : { status: 200, body: { data: { normalizedMetricsInserted: 4 } } };
      }
      if (/\/jobs\/.+\/complete$/.test(path)) {
        return { status: 200, body: { data: { status: "succeeded" } } };
      }
      return { status: 404, body: { error: { message: `unexpected ${path}` } } };
    };
    return { caller, calls };
  }

  it("processes queued connector_sync jobs to completion", async () => {
    const { caller, calls } = makeCaller([
      { id: "j1", payload: { integrationId: "int-1" } },
      { id: "j2", payload: { integrationId: "int-2", siteId: "site-2" } }
    ]);
    const result = await drainConnectorSyncJobs({ call: caller });
    expect(result.processed).toBe(2);
    expect(result.stoppedReason).toBe("empty");
    expect(result.outcomes.every((o) => o.status === "succeeded")).toBe(true);
    expect(result.outcomes[0].metricsInserted).toBe(4);
    // site-scoped job forwards the siteId to the sync call
    const syncCall = calls.find((c) => c.path === "/integrations/int-2/sync");
    expect(syncCall?.body).toEqual({ siteId: "site-2" });
  });

  it("marks the job failed when the sync errors but keeps draining", async () => {
    const { caller } = makeCaller([{ id: "j1", payload: { integrationId: "int-1" } }], 429);
    const result = await drainConnectorSyncJobs({ call: caller });
    expect(result.processed).toBe(1);
    expect(result.outcomes[0]).toMatchObject({ status: "failed", integrationId: "int-1", error: "quota exceeded" });
  });

  it("fails fast on an invalid payload without calling sync", async () => {
    const { caller, calls } = makeCaller([{ id: "j1", payload: {} }]);
    const result = await drainConnectorSyncJobs({ call: caller });
    expect(result.outcomes[0].status).toBe("failed");
    expect(calls.some((c) => /\/sync$/.test(c.path))).toBe(false);
  });
});
