import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-0.6: interner Linkgraph (API-seitig). Beweist Kanten-Persistenz (Upsert),
// Inlinks/Outlinks-Abfrage und Orphan-Erkennung. Crawler-Befuellung + UI = Follow-up.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/link-graph.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

const BASE = "https://lg.example.com";

async function seedSite(app: Awaited<ReturnType<typeof testApp>>["app"]) {
  const project = data<{ id: string }>(await app("POST", "/projects", { name: "Link Graph", slug: "link-graph" }));
  const site = data<{ id: string }>(await app("POST", `/projects/${project.id}/sites`, { baseUrl: BASE, scopeType: "domain" }));
  const root = `/projects/${project.id}/sites/${site.id}`;
  await app("POST", `${root}/discovered-urls`, {
    urls: ["a", "b", "c"].map((p, i) => ({
      id: `url-${p}`, projectId: project.id, siteId: site.id,
      url: `${BASE}/${p}`, normalizedUrl: `${BASE}/${p}`,
      source: "sitemap", discoveredFrom: null, depth: i, discoveredAt: "2026-06-02T08:00:00.000Z"
    }))
  });
  return { projectId: project.id, siteId: site.id, root };
}

test("internal links record (upsert) and expose inlinks/outlinks", async () => {
  const { app, store } = await testApp();
  try {
    const { root } = await seedSite(app);

    const recorded = await app("POST", `${root}/internal-links`, {
      edges: [
        { fromUrl: `${BASE}/a`, toUrl: `${BASE}/b`, anchor: "to B", rel: null },
        { fromUrl: `${BASE}/a`, toUrl: `${BASE}/c`, anchor: "to C", rel: null }
      ]
    });
    assert.equal(recorded.status, 201);
    assert.deepEqual(data<{ inserted: number; updated: number }>(recorded), { inserted: 2, updated: 0 });

    // Re-recording the same edge with a new anchor updates instead of duplicating.
    const again = data<{ inserted: number; updated: number }>(await app("POST", `${root}/internal-links`, {
      edges: [{ fromUrl: `${BASE}/a`, toUrl: `${BASE}/b`, anchor: "to B v2", rel: null }]
    }));
    assert.deepEqual(again, { inserted: 0, updated: 1 });

    const outA = await app("GET", `${root}/internal-links?direction=out&url=${encodeURIComponent(`${BASE}/a`)}`);
    assert.equal(outA.status, 200);
    assert.equal(data<Array<{ toUrl: string }>>(outA).length, 2);

    const inB = data<Array<{ fromUrl: string; anchor: string }>>(await app("GET", `${root}/internal-links?direction=in&url=${encodeURIComponent(`${BASE}/b`)}`));
    assert.equal(inB.length, 1);
    assert.equal(inB[0]?.fromUrl, `${BASE}/a`);
    assert.equal(inB[0]?.anchor, "to B v2");
  } finally {
    await store.close();
  }
});

test("orphan detection lists discovered URLs without inbound internal links", async () => {
  const { app, store } = await testApp();
  try {
    const { root } = await seedSite(app);
    await app("POST", `${root}/internal-links`, { edges: [{ fromUrl: `${BASE}/a`, toUrl: `${BASE}/b` }] });

    const orphans = data<Array<{ normalizedUrl: string }>>(await app("GET", `${root}/orphan-urls?limit=50`));
    const orphanUrls = orphans.map((o) => o.normalizedUrl).sort();
    // b has an inbound edge -> not orphan; a and c remain orphans.
    assert.deepEqual(orphanUrls, [`${BASE}/a`, `${BASE}/c`]);
  } finally {
    await store.close();
  }
});

test("recording internal links requires a non-empty edges array", async () => {
  const { app, store } = await testApp();
  try {
    const { root } = await seedSite(app);
    const empty = await app("POST", `${root}/internal-links`, { edges: [] });
    assert.equal(empty.status, 400);
    assert.equal((empty.body as { error: { code: string } }).error.code, "missing_field");
  } finally {
    await store.close();
  }
});
