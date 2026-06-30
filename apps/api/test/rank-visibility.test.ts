import assert from "node:assert/strict";
import test from "node:test";
import { computeVisibilityScore, positionWeight } from "@seo-tool/domain-model";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-2.2/2.3: Rank-Tracking + SERP-Snapshots/Diffs (deterministischer Provider, DEC-002)
// und Visibility-Index (transparente Formel).
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/rank-visibility.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function projectWithKeyword(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string) {
  const projectId = data<{ id: string }>(await app("POST", "/projects", { name: `Rank ${slug}`, slug })).id;
  await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://rank.example.com", scopeType: "domain" });
  const added = data<{ keywords: Array<{ id: string }> }>(await app("POST", `/projects/${projectId}/keywords`, { keywords: [{ phrase: `seo tool ${slug}` }] }));
  return { projectId, keywordId: added.keywords[0].id };
}

test("visibility formula is transparent and reproducible (pure function)", () => {
  assert.equal(positionWeight(1), 1);
  assert.equal(positionWeight(21), 0);
  assert.equal(positionWeight(11), 0.5);
  // positions 1 and 11 -> weights 1.0 and 0.5 -> avg 0.75 -> 75
  assert.deepEqual(computeVisibilityScore({ positions: [1, 11] }), { score: 75, trackedKeywords: 2, averagePosition: 6 });
  // null positions are ignored (untracked)
  assert.deepEqual(computeVisibilityScore({ positions: [null, null] }), { score: 0, trackedKeywords: 0, averagePosition: null });
});

test("recording a rank snapshot persists a SERP + rank with history (empty until a provider is connected)", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, keywordId } = await projectWithKeyword(app, "snap");
    const recorded = await app("POST", `/projects/${projectId}/keywords/${keywordId}/rank-snapshots`, { device: "desktop" });
    assert.equal(recorded.status, 201);
    const result = data<{ serpSnapshot: { results: unknown[]; sourceConfidence: string; ownPosition: number | null }; rankSnapshot: { market: string } }>(recorded);
    // No ranking source connected yet -> empty SERP, no own position; a snapshot is still recorded.
    assert.equal(result.serpSnapshot.results.length, 0);
    assert.equal(result.serpSnapshot.ownPosition, null);
    assert.equal(result.serpSnapshot.sourceConfidence, "C", "observed SERP is confidence class C");
    assert.equal(result.rankSnapshot.market, "DE");

    await app("POST", `/projects/${projectId}/keywords/${keywordId}/rank-snapshots`, {});
    const history = data<unknown[]>(await app("GET", `/projects/${projectId}/keywords/${keywordId}/rank-snapshots`));
    assert.equal(history.length, 2, "rank history accumulates");

    const diff = data<{ keywordId: string; enteredDomains: string[] }>(await app("GET", `/projects/${projectId}/keywords/${keywordId}/serp-diff`));
    assert.equal(diff.keywordId, keywordId);
    assert.ok(Array.isArray(diff.enteredDomains));
  } finally {
    await store.close();
  }
});

test("rank-snapshots/latest returns one latest position per keyword in a single call", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, keywordId } = await projectWithKeyword(app, "latest");
    // No snapshots yet -> empty list.
    const empty = data<unknown[]>(await app("GET", `/projects/${projectId}/rank-snapshots/latest`));
    assert.equal(empty.length, 0);

    // Record two snapshots for the same keyword; the bulk endpoint must collapse to the latest one.
    await app("POST", `/projects/${projectId}/keywords/${keywordId}/rank-snapshots`, {});
    await app("POST", `/projects/${projectId}/keywords/${keywordId}/rank-snapshots`, {});
    const latest = data<Array<{ keywordId: string; capturedAt: string }>>(
      await app("GET", `/projects/${projectId}/rank-snapshots/latest`)
    );
    assert.equal(latest.length, 1, "one row per keyword regardless of history depth");
    assert.equal(latest[0].keywordId, keywordId);
  } finally {
    await store.close();
  }
});

test("serp-diff requires at least one snapshot", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, keywordId } = await projectWithKeyword(app, "nodiff");
    const diff = await app("GET", `/projects/${projectId}/keywords/${keywordId}/serp-diff`);
    assert.equal(diff.status, 404);
    assert.equal((diff.body as { error: { code: string } }).error.code, "no_serp_snapshots");
  } finally {
    await store.close();
  }
});

test("visibility compute aggregates latest ranks of the tracked set and keeps history", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, keywordId } = await projectWithKeyword(app, "vis");
    // No ranks yet -> score 0.
    const empty = data<{ score: number; trackedKeywords: number }>(await app("POST", `/projects/${projectId}/visibility/compute`, {}));
    assert.equal(empty.trackedKeywords, 0);
    assert.equal(empty.score, 0);

    await app("POST", `/projects/${projectId}/keywords/${keywordId}/rank-snapshots`, {});
    const computed = data<{ score: number; trackedKeywords: number; market: string }>(await app("POST", `/projects/${projectId}/visibility/compute`, {}));
    assert.equal(computed.market, "DE");
    assert.ok(computed.trackedKeywords >= 0); // own may or may not rank for this stub phrase
    assert.ok(computed.score >= 0 && computed.score <= 100);

    const history = data<unknown[]>(await app("GET", `/projects/${projectId}/visibility`));
    assert.equal(history.length, 2, "two visibility computations recorded");
  } finally {
    await store.close();
  }
});
