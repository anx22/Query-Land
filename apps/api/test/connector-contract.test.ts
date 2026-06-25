import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";
import { getConnector, supportedConnectorProviders } from "../src/connectors/index.js";

// T5 "Connector-Verträge": beweist den typisierten describe()-Vertrag (authStatus/quota/
// freshness/capabilities) je Connector inkl. des neu registrierten Lighthouse-Stubs, das
// Surfacing über GET /integrations(/:id) und die Failure-mode-Sichtbarkeit (fehlende
// Credentials -> degraded/blocked, nicht geworfen).
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/connector-contract.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function freshProject(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string): Promise<string> {
  return data<{ id: string }>(await app("POST", "/projects", { name: `Contract ${slug}`, slug })).id;
}

type Contract = {
  provider: string;
  sourceType: string;
  sourceConfidence: string;
  authStatus: string;
  quota: { used: number; limit: number; resetsAt?: string } | null;
  freshness: { lastSyncedAt: string | null; lastEvidenceAt: string | null };
  capabilities: string[];
};

type StatusView = {
  id: string;
  provider: string;
  status: string;
  contract: Contract | null;
  lastSyncedAt: string | null;
  lastEvidenceAt: string | null;
};

type SyncResult = {
  integration: { provider: string; status: string };
  outcome: string;
  rawEventId: string | null;
  normalizedMetricsInserted: number;
  contract: Contract;
  reason?: string;
};

test("lighthouse connector is registered and returns a working stub (getConnector + describe)", () => {
  const connector = getConnector("lighthouse");
  assert.ok(connector, "getConnector('lighthouse') must not be null");
  assert.equal(connector!.provider, "lighthouse");
  assert.ok(supportedConnectorProviders().includes("lighthouse"));

  const described = connector!.describe({ hasCredentials: true, lastSyncedAt: null, lastEvidenceAt: null });
  assert.equal(described.authStatus, "connected");
  assert.ok(described.capabilities.length > 0, "lighthouse advertises capabilities");
  assert.ok(described.quota && described.quota.limit > 0, "lighthouse reports a quota budget");
});

test("each registered connector reports a coherent contract via describe()", () => {
  for (const provider of supportedConnectorProviders()) {
    const connector = getConnector(provider);
    assert.ok(connector, `connector for ${provider} exists`);

    const withCreds = connector!.describe({ hasCredentials: true, lastSyncedAt: "2026-06-01T00:00:00.000Z", lastEvidenceAt: null });
    assert.equal(withCreds.provider, provider);
    assert.equal(withCreds.authStatus, "connected");
    assert.equal(withCreds.freshness.lastSyncedAt, "2026-06-01T00:00:00.000Z");
    assert.ok(Array.isArray(withCreds.capabilities) && withCreds.capabilities.length > 0);

    const withoutCreds = connector!.describe({ hasCredentials: false, lastSyncedAt: null, lastEvidenceAt: null });
    assert.equal(withoutCreds.authStatus, "missing_credentials", `${provider} reports missing credentials when none configured`);
  }
});

test("GET /integrations/:id surfaces the connector contract (auth/quota/freshness/capabilities)", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "contract-read");
    const created = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "lighthouse" }));

    const view = data<StatusView>(await app("GET", `/integrations/${created.id}`));
    assert.ok(view.contract, "status view includes a connector contract");
    assert.equal(view.contract!.provider, "lighthouse");
    // API-created integration has stub credentials -> connected.
    assert.equal(view.contract!.authStatus, "connected");
    assert.ok(view.contract!.quota, "contract exposes quota");
    assert.ok("lastSyncedAt" in view.contract!.freshness, "contract exposes freshness");
    assert.ok(view.contract!.capabilities.includes("seo"));

    // And the list endpoint also carries the contract.
    const list = data<StatusView[]>(await app("GET", "/integrations"));
    assert.ok(list.some((item) => item.id === created.id && item.contract?.provider === "lighthouse"));
  } finally {
    await store.close();
  }
});

test("lighthouse sync persists data and marks the integration connected", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "lighthouse-sync");
    const created = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "lighthouse" }));

    const res = await app("POST", `/integrations/${created.id}/sync`);
    assert.equal(res.status, 200);
    const sync = data<SyncResult>(res);
    assert.equal(sync.outcome, "ok");
    assert.equal(sync.integration.status, "connected");
    assert.ok(sync.rawEventId && sync.rawEventId.startsWith("raw-"));
    assert.ok(sync.normalizedMetricsInserted >= 4, "lighthouse normalizes multiple metrics");
    assert.equal(sync.contract.authStatus, "connected");

    // Freshness/evidence are now visible through the read endpoint.
    const view = data<StatusView>(await app("GET", `/integrations/${created.id}`));
    assert.notEqual(view.lastSyncedAt, null);
    assert.notEqual(view.lastEvidenceAt, null);
    assert.notEqual(view.contract!.freshness.lastSyncedAt, null);
  } finally {
    await store.close();
  }
});

test("sync against an integration with missing credentials surfaces a degraded/blocked status (no crash)", async () => {
  const { app, store } = await testApp();
  try {
    // Seeded int-gsc-demo has an empty auth_config -> represents missing credentials.
    const res = await app("POST", "/integrations/int-gsc-demo/sync");
    assert.equal(res.status, 200, "missing credentials must not be a hard failure");
    const sync = data<SyncResult>(res);
    assert.equal(sync.outcome, "missing_credentials");
    assert.equal(sync.integration.status, "degraded");
    assert.equal(sync.rawEventId, null);
    assert.equal(sync.normalizedMetricsInserted, 0);
    assert.ok(typeof sync.reason === "string" && sync.reason.length > 0, "a human-readable reason is surfaced");
    assert.equal(sync.contract.authStatus, "missing_credentials");

    // The blocked state is queryable afterwards.
    const view = data<StatusView>(await app("GET", "/integrations/int-gsc-demo"));
    assert.equal(view.status, "degraded");
    assert.equal(view.contract!.authStatus, "missing_credentials");
  } finally {
    await store.close();
  }
});

test("GET /integrations/:id returns 404 for an unknown integration", async () => {
  const { app, store } = await testApp();
  try {
    const res = await app("GET", "/integrations/int-does-not-exist");
    assert.equal(res.status, 404);
    assert.equal((res.body as { error: { code: string } }).error.code, "unknown_integration");
  } finally {
    await store.close();
  }
});
