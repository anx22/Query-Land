import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-1.3: erster Generator + Validierungsloop (§6.6/§6.5). Aus Indexierbarkeits-Blockern
// entstehen technical_fix-Opportunities; der Re-Check setzt implemented -> validated|reopened.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/opportunity-generator.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

const URL = "https://gen.example.com/pricing";

async function siteWithBlockedUrl(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string) {
  const projectId = data<{ id: string }>(await app("POST", "/projects", { name: `Gen ${slug}`, slug })).id;
  const siteId = data<{ id: string }>(await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://gen.example.com", scopeType: "domain", businessValue: 90 })).id;
  const base = `/projects/${projectId}/sites/${siteId}`;
  await app("POST", `${base}/discovered-urls`, {
    urls: [{ id: "url-x", projectId, siteId, url: URL, normalizedUrl: URL, source: "sitemap", discoveredFrom: null, depth: 1, discoveredAt: "2026-06-02T08:00:00.000Z" }]
  });
  await app("POST", `${base}/discovered-urls/url-x/indexability`, {
    url: URL, state: "blocked_by_meta", isIndexable: false, reasons: ["meta noindex"], canonicalUrl: null, fetchResultId: null, assessedAt: "2026-06-02T08:05:00.000Z"
  });
  return { projectId, siteId, base };
}

test("indexability blockers generate technical_fix opportunities (idempotent)", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId } = await siteWithBlockedUrl(app, "generate");

    const first = await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate-indexability`);
    assert.equal(first.status, 201);
    const result = data<{ created: number; opportunities: Array<{ type: string; status: string; validationMetric: string; affectedUrls: string[] }> }>(first);
    assert.equal(result.created, 1);
    assert.equal(result.opportunities[0]?.type, "technical_fix");
    assert.equal(result.opportunities[0]?.status, "open");
    assert.equal(result.opportunities[0]?.validationMetric, "indexable");
    assert.deepEqual(result.opportunities[0]?.affectedUrls, [URL]);

    // Re-running does not duplicate while the opportunity is still active.
    const second = data<{ created: number }>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate-indexability`));
    assert.equal(second.created, 0);
  } finally {
    await store.close();
  }
});

test("validation loop: implemented + now-indexable -> validated with updated evidence", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId, base } = await siteWithBlockedUrl(app, "validated");
    const oppId = data<{ opportunities: Array<{ id: string }> }>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate-indexability`)).opportunities[0].id;

    await app("POST", `/opportunities/${oppId}/transition`, { status: "in_progress" });
    await app("POST", `/opportunities/${oppId}/transition`, { status: "implemented" });

    // Re-crawl shows the URL is now indexable.
    await app("POST", `${base}/discovered-urls/url-x/indexability`, {
      url: URL, state: "indexable", isIndexable: true, reasons: [], canonicalUrl: null, fetchResultId: null, assessedAt: "2026-06-09T08:00:00.000Z"
    });

    const revalidated = await app("POST", `/opportunities/${oppId}/revalidate`);
    assert.equal(revalidated.status, 200);
    const result = data<{ status: string; evidence: Array<{ metric: string; beforeValue: unknown; currentValue: unknown }> }>(revalidated);
    assert.equal(result.status, "validated");
    const evidence = result.evidence.find((e) => e.metric === "indexable");
    assert.equal(evidence?.beforeValue, "false");
    assert.equal(evidence?.currentValue, "true");
  } finally {
    await store.close();
  }
});

test("validation loop: implemented but still blocked -> reopened", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId } = await siteWithBlockedUrl(app, "reopened");
    const oppId = data<{ opportunities: Array<{ id: string }> }>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate-indexability`)).opportunities[0].id;
    await app("POST", `/opportunities/${oppId}/transition`, { status: "in_progress" });
    await app("POST", `/opportunities/${oppId}/transition`, { status: "implemented" });

    // No new assessment -> still blocked.
    const result = data<{ status: string }>(await app("POST", `/opportunities/${oppId}/revalidate`));
    assert.equal(result.status, "reopened");
  } finally {
    await store.close();
  }
});

test("revalidate rejects opportunities that are not implemented", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId } = await siteWithBlockedUrl(app, "guard");
    const oppId = data<{ opportunities: Array<{ id: string }> }>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate-indexability`)).opportunities[0].id;
    const tooEarly = await app("POST", `/opportunities/${oppId}/revalidate`);
    assert.equal(tooEarly.status, 409);
    assert.equal((tooEarly.body as { error: { code: string } }).error.code, "invalid_state");
  } finally {
    await store.close();
  }
});
