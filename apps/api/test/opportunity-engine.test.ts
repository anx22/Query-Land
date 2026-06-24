import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createSQLiteStore } from "../src/sqlite-store.js";

// WP-3.2: fünf harte Opportunity-Klassen (§6.1). Search-Performance speist low_hanging_keyword,
// money_page und cannibalization; der Linkgraph speist internal_link_gap. Der Umbrella-Generator
// erzeugt alle Klassen idempotent.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/opportunity-engine.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createSQLiteStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

interface GenResult {
  created: number;
  opportunities: Array<{ type: string; affectedUrls: string[]; evidence: Array<{ sourceConfidence: string }> }>;
}

test("search opportunities generate low-hanging, money-page and cannibalization classes (idempotent)", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "Engine", slug: "engine" })).id;
    const siteId = data<{ id: string }>(await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://engine.example.com", scopeType: "domain" })).id;
    await app("POST", `/projects/${projectId}/sites/${siteId}/search-performance/sync`, {});

    const gen = data<GenResult>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate`, {}));
    const byType = (type: string) => gen.opportunities.filter((opp) => opp.type === type).length;
    assert.ok(byType("low_hanging_keyword") >= 1, "striking-distance queries become low-hanging opportunities");
    assert.ok(byType("money_page") >= 1, "ctr gaps become money-page opportunities");
    assert.ok(byType("cannibalization") >= 1, "multi-page queries become cannibalization opportunities");
    // Every generated opportunity carries acceptable evidence (class A-C, here GSC = B).
    assert.ok(gen.opportunities.every((opp) => opp.evidence.some((ev) => ["A", "B", "C"].includes(ev.sourceConfidence))));

    const list = data<Array<{ type: string; priority: number }>>(await app("GET", `/projects/${projectId}/opportunities?limit=100`));
    assert.equal(list.length, gen.created, "all generated opportunities are listable");
    // Listing is priority-ordered (descending).
    for (let index = 1; index < list.length; index += 1) {
      assert.ok(list[index - 1].priority >= list[index].priority);
    }

    const again = data<{ created: number }>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate`, {}));
    assert.equal(again.created, 0, "re-running the generator is idempotent");
  } finally {
    await store.close();
  }
});

test("internal link gap opportunities are generated from orphan URLs once a link graph exists", async () => {
  const { app, store } = await testApp();
  const BASE = "https://links.example.com";
  try {
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "Links", slug: "links" })).id;
    const siteId = data<{ id: string }>(await app("POST", `/projects/${projectId}/sites`, { baseUrl: BASE, scopeType: "domain" })).id;
    const root = `/projects/${projectId}/sites/${siteId}`;
    await app("POST", `${root}/discovered-urls`, {
      urls: ["a", "b", "c"].map((path, index) => ({
        id: `url-${path}`, projectId, siteId,
        url: `${BASE}/${path}`, normalizedUrl: `${BASE}/${path}`,
        source: "sitemap", discoveredFrom: null, depth: index, discoveredAt: "2026-06-02T08:00:00.000Z"
      }))
    });

    // Without any edges there is no link graph -> no orphan signal.
    const before = data<GenResult>(await app("POST", `${root}/opportunities/generate`, {}));
    assert.equal(before.opportunities.filter((opp) => opp.type === "internal_link_gap").length, 0);

    await app("POST", `${root}/internal-links`, { edges: [{ fromUrl: `${BASE}/a`, toUrl: `${BASE}/b` }] });

    const after = data<GenResult>(await app("POST", `${root}/opportunities/generate`, {}));
    const gaps = after.opportunities.filter((opp) => opp.type === "internal_link_gap");
    const gapUrls = gaps.flatMap((opp) => opp.affectedUrls).sort();
    // b now has an inbound edge; a and c are orphans.
    assert.deepEqual(gapUrls, [`${BASE}/a`, `${BASE}/c`]);
    assert.ok(gaps.every((opp) => opp.evidence.some((ev) => ev.sourceConfidence === "A")), "orphan evidence is crawl-based (class A)");
  } finally {
    await store.close();
  }
});
