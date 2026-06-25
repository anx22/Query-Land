import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// D1: Crawl-Diff Backend (UX-6b). Endpoint coverage for
// GET /projects/:p/sites/:s/crawl-runs/diff?base=&compare=
//
// Local run:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/crawl-diff.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

interface DiffResult {
  baseRunId: string;
  compareRunId: string;
  baseAsOf: string;
  compareAsOf: string;
  appearedIssues: Array<{ id: string }>;
  fixedIssues: Array<{ id: string }>;
  persistingCount: number;
  newUrls: Array<{ id: string }>;
  deltas: { healthScore: number | null; openIssues: number; discoveredUrls: number };
}

test("crawl-runs diff endpoint reports appeared/fixed/persisting issues and new urls between two runs", async () => {
  const { app, store } = await testApp();
  const base = "/projects/proj-demo/sites/site-demo";
  try {
    // ---- Establish base run state: one open issue (persist) + one that will be fixed. ----
    await app("POST", `${base}/discovered-urls`, {
      urls: [
        { id: "url-persist", projectId: "proj-demo", siteId: "site-demo", url: "https://example.com/persist", normalizedUrl: "https://example.com/persist", source: "sitemap", discoveredFrom: null, depth: 1, discoveredAt: "2026-06-01T08:00:00.000Z" },
        { id: "url-fixed", projectId: "proj-demo", siteId: "site-demo", url: "https://example.com/fixed", normalizedUrl: "https://example.com/fixed", source: "sitemap", discoveredFrom: null, depth: 1, discoveredAt: "2026-06-01T08:00:00.000Z" }
      ]
    });
    await app("POST", `${base}/audit-issues`, {
      checkedDiscoveredUrlIds: ["url-persist", "url-fixed"],
      issues: [
        { id: "issue-persist", projectId: "proj-demo", siteId: "site-demo", discoveredUrlId: "url-persist", url: "https://example.com/persist", rule: "missing_title", severity: "medium", message: "no title", detectedAt: "2026-06-01T08:05:00.000Z", resolvedAt: null },
        { id: "issue-fixed", projectId: "proj-demo", siteId: "site-demo", discoveredUrlId: "url-fixed", url: "https://example.com/fixed", rule: "http_error", severity: "critical", message: "boom", detectedAt: "2026-06-01T08:05:00.000Z", resolvedAt: null }
      ]
    });

    // Complete the base run (snapshots summary + finished_at = now).
    const runA = data<{ id: string }>(await app("POST", `${base}/crawl-runs`, { trigger: "manual" }));
    const completedA = data<{ id: string; finishedAt: string }>(await app("POST", `${base}/crawl-runs/${runA.id}/complete`, { status: "succeeded" }));
    assert.ok(completedA.finishedAt);

    // ---- Between the two runs: fix one issue, add a new url + a new issue (appeared). ----
    await app("POST", `${base}/audit-issues/issue-fixed/resolve`);
    await app("POST", `${base}/discovered-urls`, {
      urls: [{ id: "url-new", projectId: "proj-demo", siteId: "site-demo", url: "https://example.com/new", normalizedUrl: "https://example.com/new", source: "link", discoveredFrom: null, depth: 2, discoveredAt: new Date().toISOString() }]
    });
    await app("POST", `${base}/audit-issues`, {
      checkedDiscoveredUrlIds: ["url-new"],
      issues: [{ id: "issue-appeared", projectId: "proj-demo", siteId: "site-demo", discoveredUrlId: "url-new", url: "https://example.com/new", rule: "missing_title", severity: "low", message: "new issue", detectedAt: new Date().toISOString(), resolvedAt: null }]
    });

    const runB = data<{ id: string }>(await app("POST", `${base}/crawl-runs`, { trigger: "scheduled" }));
    await app("POST", `${base}/crawl-runs/${runB.id}/complete`, { status: "succeeded" });

    // ---- Diff ----
    const diffResponse = await app("GET", `${base}/crawl-runs/diff?base=${runA.id}&compare=${runB.id}`);
    assert.equal(diffResponse.status, 200);
    const diff = data<DiffResult>(diffResponse);

    assert.equal(diff.baseRunId, runA.id);
    assert.equal(diff.compareRunId, runB.id);
    assert.deepEqual(diff.appearedIssues.map((i) => i.id), ["issue-appeared"]);
    assert.deepEqual(diff.fixedIssues.map((i) => i.id), ["issue-fixed"]);
    assert.equal(diff.persistingCount, 1, "issue-persist stays open across both runs");
    assert.ok(diff.newUrls.some((u) => u.id === "url-new"), "url discovered between runs is reported as new");
    assert.ok(!diff.newUrls.some((u) => u.id === "url-persist"), "urls discovered before base are not new");
    assert.equal(typeof diff.deltas.discoveredUrls, "number");
  } finally {
    await store.close();
  }
});

test("crawl-runs diff endpoint requires base and compare query params", async () => {
  const { app, store } = await testApp();
  const base = "/projects/proj-demo/sites/site-demo";
  try {
    const missing = await app("GET", `${base}/crawl-runs/diff`);
    assert.equal(missing.status, 400);
    assert.equal((missing.body as { error: { code: string } }).error.code, "crawl_diff_params_required");
  } finally {
    await store.close();
  }
});

test("crawl-runs diff endpoint returns 404 for an unknown run", async () => {
  const { app, store } = await testApp();
  const base = "/projects/proj-demo/sites/site-demo";
  try {
    const runA = data<{ id: string }>(await app("POST", `${base}/crawl-runs`, { trigger: "manual" }));
    await app("POST", `${base}/crawl-runs/${runA.id}/complete`, { status: "succeeded" });

    const unknown = await app("GET", `${base}/crawl-runs/diff?base=${runA.id}&compare=crawl-does-not-exist`);
    assert.equal(unknown.status, 404);
    assert.equal((unknown.body as { error: { code: string } }).error.code, "crawl_run_not_found");
  } finally {
    await store.close();
  }
});
