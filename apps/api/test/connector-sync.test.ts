import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-0.4: Connector-Vertrag (specs/integrations.md). Beweist fetch/validate/normalize plus
// Raw/Normalized-Trennung, Confidence-Tagging (Klasse B) und Status/Quota/Freshness-Update.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/connector-sync.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function freshProject(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string): Promise<string> {
  return data<{ id: string }>(await app("POST", "/projects", { name: `Connector ${slug}`, slug })).id;
}

type SyncResult = {
  integration: { provider: string; status: string; quotaRemaining: number | null; freshness: string | null };
  rawEventId: string;
  normalizedMetricsInserted: number;
};

test("GSC connector sync persists raw + normalized data and marks the integration connected", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "gsc-sync");
    const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "gsc" }));

    const syncRes = await app("POST", `/integrations/${integration.id}/sync`);
    assert.equal(syncRes.status, 200);
    const sync = data<SyncResult>(syncRes);

    assert.equal(sync.integration.status, "connected");
    assert.notEqual(sync.integration.quotaRemaining, null, "quota should be updated after a run");
    assert.notEqual(sync.integration.freshness, null, "freshness should be updated after a run");
    assert.ok(sync.rawEventId.startsWith("raw-"), "exactly one raw event is stored");
    assert.ok(sync.normalizedMetricsInserted >= 4, "GSC normalizes multiple metrics");

    // Raw (1) vs. normalized (mehrere) belegen die getrennte Persistenz.
    assert.notEqual(sync.normalizedMetricsInserted, 1);
  } finally {
    await store.close();
  }
});

test("GA4 connector sync also works (spec acceptance: GSC + GA4 connectable)", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "ga4-sync");
    const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "ga4" }));
    const sync = data<SyncResult>(await app("POST", `/integrations/${integration.id}/sync`));
    assert.equal(sync.integration.status, "connected");
    assert.equal(sync.integration.provider, "ga4");
    assert.ok(sync.normalizedMetricsInserted >= 3);
  } finally {
    await store.close();
  }
});

test("connector sync is repeatable and refreshes freshness without breaking", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "repeat-sync");
    const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "pagespeed" }));
    const first = data<SyncResult>(await app("POST", `/integrations/${integration.id}/sync`));
    const second = data<SyncResult>(await app("POST", `/integrations/${integration.id}/sync`));
    assert.equal(second.integration.status, "connected");
    assert.notEqual(first.rawEventId, second.rawEventId, "each run records a new raw event (history)");
  } finally {
    await store.close();
  }
});

test("connector sync rejects providers without an implemented connector", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "unsupported-sync");
    const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "serp" }));
    const sync = await app("POST", `/integrations/${integration.id}/sync`);
    assert.equal(sync.status, 400);
    assert.equal((sync.body as { error: { code: string } }).error.code, "unsupported_connector");
  } finally {
    await store.close();
  }
});

test("connector sync on unknown integration id returns 404", async () => {
  const { app, store } = await testApp();
  try {
    const sync = await app("POST", "/integrations/int-does-not-exist/sync");
    assert.equal(sync.status, 404);
    assert.equal((sync.body as { error: { code: string } }).error.code, "unknown_integration");
  } finally {
    await store.close();
  }
});

test("scheduling a connector sync enqueues an idempotent connector_sync job the worker can claim", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "sched-sync");
    const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "gsc" }));

    const first = await app("POST", `/integrations/${integration.id}/sync/schedule`);
    assert.equal(first.status, 201);
    const job = data<{ id: string; type: string; payload: Record<string, unknown> }>(first);
    assert.equal(job.type, "connector_sync");
    assert.equal(job.payload.integrationId, integration.id);

    // Same integration, same day -> idempotent (no duplicate jobs piling up).
    const second = await app("POST", `/integrations/${integration.id}/sync/schedule`);
    assert.equal(second.status, 200);
    assert.equal(data<{ id: string }>(second).id, job.id);

    const claimed = data<{ id: string } | null>(await app("POST", "/jobs/claim", { type: "connector_sync" }));
    assert.equal(claimed?.id, job.id);
  } finally {
    await store.close();
  }
});

test("scheduling a connector sync for an unknown integration returns 404", async () => {
  const { app, store } = await testApp();
  try {
    const res = await app("POST", "/integrations/int-missing/sync/schedule");
    assert.equal(res.status, 404);
    assert.equal((res.body as { error: { code: string } }).error.code, "unknown_integration");
  } finally {
    await store.close();
  }
});
