import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStoreWithDatabase } from "../src/store.js";
import { __setGscClientFactoryForTests } from "../src/oauth/gsc-credentials.js";
import { decryptJson } from "../src/oauth/token-crypto.js";
import type { GscClient } from "../src/oauth/gsc-client.js";

type ApiResponse = { status: number; body: unknown };
const data = <T>(r: ApiResponse): T => (r.body as { data: T }).data;
const future = () => new Date(Date.now() + 3600_000).toISOString();
const past = () => new Date(Date.now() - 3600_000).toISOString();

// A mock GSC client: query×page rows for the matrix sync, a single average position otherwise.
function makeMockClient(refreshCalls: string[]): GscClient {
  return {
    exchangeCodeForTokens: async () => ({ accessToken: "at", refreshToken: "rt", expiresAt: future() }),
    refreshAccessToken: async (rt: string) => {
      refreshCalls.push(rt);
      return { accessToken: "at-refreshed", expiresAt: future() };
    },
    listSites: async () => [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }],
    querySearchAnalytics: async (_token, _property, body) => {
      if ((body.dimensions?.length ?? 0) >= 2) {
        return [
          { keys: ["brand integration", "https://example.com/integration"], clicks: 12, impressions: 2000, ctr: 0.006, position: 13 }, // striking distance -> low_hanging
          { keys: ["brand pricing", "https://example.com/pricing"], clicks: 5, impressions: 5000, ctr: 0.001, position: 4 }, // top-10 ctr gap -> money_page
        ];
      }
      return [{ clicks: 10, impressions: 500, ctr: 0.02, position: 7.5 }]; // avg position for a single query
    },
  };
}

async function setup() {
  process.env.OAUTH_ENCRYPTION_KEY = "integration-test-key";
  const { store, db } = await createStoreWithDatabase("sqlite::memory:");
  const app = createApp(store);
  const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "GSC", slug: "gsc" })).id;
  const siteId = data<{ id: string }>(await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://example.com", scopeType: "domain" })).id;
  return { app, db, projectId, siteId };
}

test("connected GSC lights up real search-performance, opportunities and visibility", async (t) => {
  const refreshCalls: string[] = [];
  __setGscClientFactoryForTests(() => makeMockClient(refreshCalls));
  t.after(() => {
    __setGscClientFactoryForTests(null);
    delete process.env.OAUTH_ENCRYPTION_KEY;
  });

  const { app, projectId, siteId } = await setup();

  // Store exchanged OAuth credentials (encrypted) and mark the integration connected.
  const cred = await app("POST", "/integrations/credentials", {
    projectId, provider: "gsc", property: "sc-domain:example.com", accessToken: "at", refreshToken: "rt", expiresAt: future(),
  });
  assert.equal(cred.status, 200);
  assert.equal(data<{ status: string }>(cred).status, "connected");
  assert.equal((cred.body as { data: Record<string, unknown> }).data.auth_config, undefined, "response never echoes credentials");

  // Search-performance sync now returns REAL (mock) GSC rows, confidence B.
  const synced = data<{ inserted: number; market: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/search-performance/sync`, {}));
  assert.equal(synced.inserted, 2);
  const rows = data<Array<{ sourceConfidence: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/search-performance`));
  assert.equal(rows[0].sourceConfidence, "B");

  const intel = data<{ summary: { strikingDistance: number; ctrGaps: number } }>(await app("GET", `/projects/${projectId}/sites/${siteId}/search-performance/intelligence`));
  assert.ok(intel.summary.strikingDistance >= 1);
  assert.ok(intel.summary.ctrGaps >= 1);

  // Opportunities are generated from the real rows.
  const gen = data<{ opportunities: Array<{ type: string }> }>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate`, {}));
  assert.ok(gen.opportunities.some((o) => o.type === "low_hanging_keyword"), "striking-distance -> low_hanging_keyword");

  // Rankings + visibility from GSC average position.
  const keywordId = data<{ keywords: Array<{ id: string }> }>(await app("POST", `/projects/${projectId}/keywords`, { keywords: [{ phrase: "brand integration" }] })).keywords[0].id;
  const snap = data<{ rankSnapshot: { position: number | null }; serpSnapshot: { sourceConfidence: string } }>(
    await app("POST", `/projects/${projectId}/keywords/${keywordId}/rank-snapshots`, {}),
  );
  assert.equal(snap.rankSnapshot.position, 8, "rank position is the GSC average position (7.5) rounded to a rank");
  assert.equal(snap.serpSnapshot.sourceConfidence, "B");

  const vis = data<{ score: number; trackedKeywords: number }>(await app("POST", `/projects/${projectId}/visibility/compute`, {}));
  assert.equal(vis.trackedKeywords, 1);
  assert.ok(vis.score > 0, "visibility score reflects the tracked position");
});

test("an expired access token is refreshed and the new token is persisted (encrypted)", async (t) => {
  const refreshCalls: string[] = [];
  __setGscClientFactoryForTests(() => makeMockClient(refreshCalls));
  t.after(() => {
    __setGscClientFactoryForTests(null);
    delete process.env.OAUTH_ENCRYPTION_KEY;
  });

  const { app, db, projectId, siteId } = await setup();
  // Store credentials whose access token is already expired.
  await app("POST", "/integrations/credentials", {
    projectId, provider: "gsc", property: "sc-domain:example.com", accessToken: "at-old", refreshToken: "rt-old", expiresAt: past(),
  });

  await app("POST", `/projects/${projectId}/sites/${siteId}/search-performance/sync`, {});

  assert.deepEqual(refreshCalls, ["rt-old"], "the refresh token was exchanged exactly once");
  const row = (await db.prepare(`SELECT auth_config FROM integration_accounts WHERE project_id = ? AND provider = 'gsc'`).get(projectId)) as { auth_config: string };
  const stored = decryptJson<{ accessToken: string; refreshToken: string }>(row.auth_config);
  assert.equal(stored.accessToken, "at-refreshed");
  assert.equal(stored.refreshToken, "rt-old", "refresh token preserved when Google omits a new one");
});
