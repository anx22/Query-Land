import assert from "node:assert/strict";
import test from "node:test";
import { getConnector, type ConnectorContext } from "../src/connectors/index.js";
import {
  resolveGscCredentials,
  resolvePsiCredentials,
  hasRealCredentials
} from "../src/connectors/credential-resolution.js";
import { mapGscRows, mapPsiRows, mapLighthouseRows } from "../src/connectors/adapters.js";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";

// B3 "Real connector adapters": proves the now-async fetch() takes a real network path when
// credentials/env are present (mapping → normalized rows), falls back to the stub otherwise, and
// surfaces typed degraded/quota/expired outcomes on non-2xx — all network-free via an injected
// fetchImpl + env. Also proves the connector_sync caller awaits the async fetch and persists.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/connector-adapters.test.js

type FetchImpl = typeof fetch;

/** Build a fake fetch that returns one canned JSON response with a chosen status. */
function fakeFetch(status: number, json: unknown, onCall?: (url: string) => void): FetchImpl {
  return (async (input: unknown) => {
    onCall?.(String(input));
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: `status ${status}`,
      json: async () => json
    } as Response;
  }) as unknown as FetchImpl;
}

const baseCtx = (over: Partial<ConnectorContext> = {}): ConnectorContext => ({
  projectId: "proj-1",
  integrationId: "int-1",
  now: "2026-06-26T00:00:00.000Z",
  entityType: "project",
  entityId: "proj-1",
  hasCredentials: true,
  authConfig: null,
  siteUrl: "sc-domain:example.com",
  env: {},
  ...over
});

// ---------------------------------------------------------------------------
// Credential resolution helper
// ---------------------------------------------------------------------------

test("resolveGscCredentials prefers auth_config token, falls back to env, else null", () => {
  assert.equal(resolveGscCredentials(null, {}), null);
  const fromEnv = resolveGscCredentials(null, { GSC_ACCESS_TOKEN: "env-tok" });
  assert.equal(fromEnv?.accessToken, "env-tok");
  const fromCfg = resolveGscCredentials({ accessToken: "cfg-tok", property: "sc-domain:x" }, { GSC_ACCESS_TOKEN: "env-tok" });
  assert.equal(fromCfg?.accessToken, "cfg-tok");
  assert.equal(fromCfg?.property, "sc-domain:x");
});

test("resolvePsiCredentials reads PAGESPEED_API_KEY / auth_config apiKey", () => {
  assert.equal(resolvePsiCredentials(null, {}), null);
  assert.equal(resolvePsiCredentials(null, { PAGESPEED_API_KEY: "k" })?.apiKey, "k");
  assert.equal(resolvePsiCredentials({ apiKey: "ck" }, {})?.apiKey, "ck");
});

test("hasRealCredentials: lighthouse shares the PSI key, unknown providers are false", () => {
  assert.equal(hasRealCredentials("lighthouse", null, { PAGESPEED_API_KEY: "k" }), true);
  assert.equal(hasRealCredentials("pagespeed", null, { PAGESPEED_API_KEY: "k" }), true);
  assert.equal(hasRealCredentials("gsc", { accessToken: "t" }, {}), true);
  assert.equal(hasRealCredentials("ga4", { accessToken: "t" }, { PAGESPEED_API_KEY: "k" }), false);
});

// ---------------------------------------------------------------------------
// Pure mappers
// ---------------------------------------------------------------------------

test("mapGscRows aggregates clicks/impressions and averages ctr/position", () => {
  const rows = mapGscRows([
    { clicks: 10, impressions: 100, ctr: 0.1, position: 4 },
    { clicks: 30, impressions: 300, ctr: 0.1, position: 6 }
  ]);
  const byMetric = Object.fromEntries(rows.map((r) => [r.metric, r.value]));
  assert.equal(byMetric.clicks, 40);
  assert.equal(byMetric.impressions, 400);
  assert.equal(byMetric.ctr, 0.1);
  assert.equal(byMetric.position, 5);
});

test("mapPsiRows / mapLighthouseRows read the PSI lighthouseResult", () => {
  const json = {
    lighthouseResult: {
      audits: {
        "largest-contentful-paint": { numericValue: 2200 },
        "cumulative-layout-shift": { numericValue: 0.03 },
        "interaction-to-next-paint": { numericValue: 150 },
        "server-response-time": { numericValue: 280 }
      },
      categories: {
        performance: { score: 0.9 },
        accessibility: { score: 0.95 },
        "best-practices": { score: 0.93 },
        seo: { score: 1 }
      }
    }
  };
  const psi = Object.fromEntries(mapPsiRows(json).map((r) => [r.metric, r.value]));
  assert.equal(psi.lcp_ms, 2200);
  assert.equal(psi.inp_ms, 150);
  const lh = Object.fromEntries(mapLighthouseRows(json).map((r) => [r.metric, r.value]));
  assert.equal(lh.performance, 0.9);
  assert.equal(lh.best_practices, 0.93);
});

// ---------------------------------------------------------------------------
// Connector fetch() — real path, fallback, failure modes (all network-free)
// ---------------------------------------------------------------------------

test("GSC fetch: real success maps live rows when an access token is present", async () => {
  const connector = getConnector("gsc")!;
  let calledUrl = "";
  const result = await connector.fetch(
    baseCtx({
      env: { GSC_ACCESS_TOKEN: "tok" },
      fetchImpl: fakeFetch(200, { rows: [{ clicks: 5, impressions: 50, ctr: 0.1, position: 3 }] }, (u) => (calledUrl = u))
    })
  );
  assert.equal(result.outcome, "ok");
  assert.match(calledUrl, /searchAnalytics\/query/);
  const rows = (result.payload as { rows: Array<{ metric: string; value: number }> }).rows;
  assert.equal(rows.find((r) => r.metric === "clicks")!.value, 5);
});

test("GSC fetch: non-2xx becomes a typed degraded outcome (never throws)", async () => {
  const connector = getConnector("gsc")!;
  const result = await connector.fetch(
    baseCtx({ env: { GSC_ACCESS_TOKEN: "tok" }, fetchImpl: fakeFetch(500, { error: { message: "boom" } }) })
  );
  assert.equal(result.outcome, "degraded");
  assert.ok(result.reason && result.reason.includes("500"));
});

test("GSC fetch: 401 → expired, 429 → quota_exceeded", async () => {
  const connector = getConnector("gsc")!;
  const expired = await connector.fetch(baseCtx({ env: { GSC_ACCESS_TOKEN: "t" }, fetchImpl: fakeFetch(401, {}) }));
  assert.equal(expired.outcome, "expired");
  const quota = await connector.fetch(baseCtx({ env: { GSC_ACCESS_TOKEN: "t" }, fetchImpl: fakeFetch(429, {}) }));
  assert.equal(quota.outcome, "quota_exceeded");
});

test("GSC fetch: no token (missing key) falls back to the deterministic stub", async () => {
  const connector = getConnector("gsc")!;
  const result = await connector.fetch(baseCtx({ env: {}, fetchImpl: fakeFetch(500, {}) }));
  assert.equal(result.outcome, "ok");
  // Stub values, not live (fetchImpl must not have been used).
  const rows = (result.payload as { rows: Array<{ metric: string; value: number }> }).rows;
  assert.equal(rows.find((r) => r.metric === "clicks")!.value, 1280);
});

test("GSC fetch: no auth_config at all → missing_credentials (unchanged behavior)", async () => {
  const connector = getConnector("gsc")!;
  const result = await connector.fetch(baseCtx({ hasCredentials: false, env: { GSC_ACCESS_TOKEN: "t" } }));
  assert.equal(result.outcome, "missing_credentials");
});

test("PSI fetch: real success maps web vitals; lighthouse derives from the same PSI response", async () => {
  const psiJson = {
    lighthouseResult: {
      audits: { "largest-contentful-paint": { numericValue: 1900 } },
      categories: { performance: { score: 0.88 } }
    }
  };
  const psi = await getConnector("pagespeed")!.fetch(
    baseCtx({ siteUrl: "https://example.com", env: { PAGESPEED_API_KEY: "k" }, fetchImpl: fakeFetch(200, psiJson) })
  );
  assert.equal(psi.outcome, "ok");
  assert.equal((psi.payload as { rows: Array<{ metric: string; value: number }> }).rows.find((r) => r.metric === "lcp_ms")!.value, 1900);

  const lh = await getConnector("lighthouse")!.fetch(
    baseCtx({ siteUrl: "https://example.com", env: { PAGESPEED_API_KEY: "k" }, fetchImpl: fakeFetch(200, psiJson) })
  );
  assert.equal(lh.outcome, "ok");
  assert.equal((lh.payload as { rows: Array<{ metric: string; value: number }> }).rows.find((r) => r.metric === "performance")!.value, 0.88);
});

test("PSI fetch: missing key → stub fallback", async () => {
  const result = await getConnector("pagespeed")!.fetch(baseCtx({ siteUrl: "https://example.com", env: {} }));
  assert.equal(result.outcome, "ok");
  assert.equal((result.payload as { rows: Array<{ metric: string; value: number }> }).rows.find((r) => r.metric === "lcp_ms")!.value, 2410);
});

// ---------------------------------------------------------------------------
// connector_sync caller awaits the async fetch and persists
// ---------------------------------------------------------------------------

test("connector_sync awaits the async fetch and persists normalized rows", async () => {
  const store = await createStore("sqlite::memory:");
  try {
    const app = createApp(store);
    const data = <T>(r: { body: unknown }) => (r.body as { data: T }).data;
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "B3", slug: "b3-sync" })).id;
    const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId, provider: "gsc" }));
    const sync = data<{ outcome: string; rawEventId: string | null; normalizedMetricsInserted: number }>(
      await app("POST", `/integrations/${integration.id}/sync`)
    );
    // No real GSC token in the test env → stub path, but the async fetch is awaited & persisted.
    assert.equal(sync.outcome, "ok");
    assert.ok(sync.rawEventId && sync.rawEventId.startsWith("raw-"));
    assert.ok(sync.normalizedMetricsInserted >= 4);
  } finally {
    await store.close();
  }
});
