import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCannibalization, analyzeCtrGap, analyzeStrikingDistance, expectedCtrForPosition, type SearchPerformanceMetricRow } from "@seo-tool/domain-model";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-3.1: Search-Performance-Intelligence (Welle 4). Deterministischer GSC-Stub (Klasse B,
// DEC-002) speist die drei Gap-Analysen Striking-Distance, CTR-Gap und Kannibalisierung.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/search-performance.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

const ROWS: SearchPerformanceMetricRow[] = [
  { query: "alpha", pageUrl: "https://x/a", clicks: 5, impressions: 5000, ctr: 0.001, position: 4 }, // top10 underperformer
  { query: "beta", pageUrl: "https://x/b", clicks: 80, impressions: 1000, ctr: 0.08, position: 4 }, // top10 healthy
  { query: "gamma", pageUrl: "https://x/c", clicks: 12, impressions: 2000, ctr: 0.006, position: 13 }, // striking distance
  { query: "delta", pageUrl: "https://x/d", clicks: 1, impressions: 50, ctr: 0.02, position: 35 }, // far away
  { query: "alpha", pageUrl: "https://x/a2", clicks: 3, impressions: 800, ctr: 0.00375, position: 9 } // cannibalizes "alpha"
];

test("expectedCtrForPosition is a transparent monotonic benchmark", () => {
  assert.equal(expectedCtrForPosition(1), 0.28);
  assert.equal(expectedCtrForPosition(10), 0.025);
  assert.equal(expectedCtrForPosition(15), 0.015);
  assert.equal(expectedCtrForPosition(0), 0);
  assert.ok(expectedCtrForPosition(3) > expectedCtrForPosition(8));
});

test("striking distance keeps only positions 11-20, sorted by impressions", () => {
  const items = analyzeStrikingDistance(ROWS);
  assert.equal(items.length, 1);
  assert.equal(items[0].query, "gamma");
  assert.equal(items[0].position, 13);
});

test("ctr gap flags top-10 underperformers with missed clicks", () => {
  const items = analyzeCtrGap(ROWS);
  // "alpha" at pos 4 (ctr 0.001 vs benchmark 0.08) is the strongest underperformer.
  assert.ok(items.length >= 1);
  assert.equal(items[0].query, "alpha");
  assert.ok(items[0].missedClicks > 0);
  assert.ok(items[0].ctrGap > 0);
  // The healthy "beta" row (ctr 0.08 == benchmark) must NOT appear.
  assert.ok(!items.some((item) => item.query === "beta"));
});

test("cannibalization groups multiple own pages per query", () => {
  const items = analyzeCannibalization(ROWS);
  assert.equal(items.length, 1);
  assert.equal(items[0].query, "alpha");
  assert.equal(items[0].pages.length, 2);
  assert.equal(items[0].totalImpressions, 5800);
});

test("sync persists a GSC batch (class B) and intelligence derives signals", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "SP", slug: "sp" })).id;
    const siteId = data<{ id: string }>(await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://acme.example.com", scopeType: "domain" })).id;

    const synced = await app("POST", `/projects/${projectId}/sites/${siteId}/search-performance/sync`, {});
    assert.equal(synced.status, 202);
    const syncResult = data<{ inserted: number; market: string }>(synced);
    assert.equal(syncResult.market, "DE");
    assert.equal(syncResult.inserted, 13);

    const list = await app("GET", `/projects/${projectId}/sites/${siteId}/search-performance`);
    assert.equal(list.status, 200);
    const rows = data<Array<{ sourceConfidence: string }>>(list);
    assert.equal((list.body as { meta: { total: number } }).meta.total, 13);
    assert.equal(rows[0].sourceConfidence, "B", "GSC search analytics is confidence class B");

    const intelligence = data<{
      summary: { rows: number; strikingDistance: number; ctrGaps: number; cannibalization: number };
      cannibalization: Array<{ pages: unknown[] }>;
    }>(await app("GET", `/projects/${projectId}/sites/${siteId}/search-performance/intelligence`));
    assert.equal(intelligence.summary.rows, 13);
    assert.equal(intelligence.summary.strikingDistance, 6, "six positions fall in 11-20");
    assert.ok(intelligence.summary.ctrGaps >= 6, "underperforming top-10 rows produce ctr gaps");
    assert.ok(intelligence.summary.cannibalization >= 1);
    assert.ok(intelligence.cannibalization[0].pages.length >= 2);
  } finally {
    await store.close();
  }
});

test("search-performance sync rejects unknown site", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "SP2", slug: "sp2" })).id;
    const missing = await app("POST", `/projects/${projectId}/sites/site-nope/search-performance/sync`, {});
    assert.equal(missing.status, 404);
    assert.equal((missing.body as { error: { code: string } }).error.code, "unknown_site");
  } finally {
    await store.close();
  }
});
