import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";
import { seedDemoFoundation } from "./helpers/demo-foundation.js";

async function testApp() {
  const store = await createStore("sqlite::memory:");
  await seedDemoFoundation(store);
  return { app: createApp(store), store };
}

const P = "proj-demo";
const S = "site-demo";

test("content brief CRUD + lifecycle transitions", async () => {
  const { app, store } = await testApp();

  const created = await app("POST", `/projects/${P}/sites/${S}/content-recommendations`, {
    url: "https://example.com/blog/seo-guide",
    title: "Refresh the SEO guide",
    targetTopic: "technical seo",
    targetQueries: ["seo guide", "seo basics"],
    intent: "informational",
    sections: ["Intro", "Crawling"],
    terms: [{ term: "canonical", done: false }],
    validationMetric: "clicks"
  });
  assert.equal(created.status, 201);
  const brief = (created.body as { data: { id: string; status: string; targetQueries: string[]; terms: Array<{ term: string }> } }).data;
  assert.equal(brief.status, "draft");
  assert.deepEqual(brief.targetQueries, ["seo guide", "seo basics"]);
  assert.equal(brief.terms[0].term, "canonical");

  // Get
  const fetched = await app("GET", `/content-recommendations/${brief.id}`);
  assert.equal(fetched.status, 200);
  assert.equal((fetched.body as { data: { title: string } }).data.title, "Refresh the SEO guide");

  // Update (editable while not terminal)
  const updated = await app("PATCH", `/content-recommendations/${brief.id}`, { title: "Refresh the SEO guide (2026)", notes: "prioritise" });
  assert.equal(updated.status, 200);
  assert.equal((updated.body as { data: { title: string; notes: string } }).data.title, "Refresh the SEO guide (2026)");

  // List + status filter
  const list = await app("GET", `/projects/${P}/sites/${S}/content-recommendations`);
  assert.equal(list.status, 200);
  assert.ok((list.body as { data: Array<{ id: string }> }).data.some((b) => b.id === brief.id));

  // Lifecycle: draft -> ready -> in_progress -> done
  for (const next of ["ready", "in_progress", "done"]) {
    const t = await app("POST", `/content-recommendations/${brief.id}/transition`, { status: next });
    assert.equal(t.status, 200);
    assert.equal((t.body as { data: { status: string } }).data.status, next);
  }

  // Illegal transition (done -> ready) rejected.
  const illegal = await app("POST", `/content-recommendations/${brief.id}/transition`, { status: "ready" });
  assert.equal(illegal.status, 409);

  // Cannot edit a done brief.
  const editDone = await app("PATCH", `/content-recommendations/${brief.id}`, { title: "nope" });
  assert.equal(editDone.status, 409);

  await store.close();
});

test("refresh candidates derived from clicks decay + open issues (deterministic)", async () => {
  const { app, store } = await testApp();

  // Record a clicks time-series ourselves (production no longer seeds demo metrics): a steeply
  // decaying guide (refresh candidate) and a growing pricing page (must NOT be a candidate).
  const captures = ["2026-04-02T00:00:00.000Z", "2026-05-02T00:00:00.000Z", "2026-06-02T00:00:00.000Z"];
  const series: Array<{ url: string; values: [number, number, number] }> = [
    { url: "https://example.com/blog/seo-guide", values: [820, 540, 310] },
    { url: "https://example.com/pricing", values: [400, 420, 450] }
  ];
  const metrics = series.flatMap((entry) =>
    captures.map((capturedAt, i) => ({ url: entry.url, metric: "clicks", value: entry.values[i], capturedAt, sourceConfidence: "B" }))
  );
  const seedRes = await app("POST", `/projects/${P}/sites/${S}/page-metrics`, { metrics });
  assert.equal(seedRes.status, 201);

  const res = await app("GET", `/projects/${P}/sites/${S}/refresh-candidates`);
  assert.equal(res.status, 200);
  const candidates = (res.body as { data: Array<{ url: string; refreshScore: number; clicksTrend: number }> }).data;

  // The growing /pricing page must NOT be a candidate.
  assert.ok(!candidates.some((c) => c.url.endsWith("/pricing")));
  // The steeply decaying guide leads the list.
  assert.equal(candidates[0]?.url, "https://example.com/blog/seo-guide");
  assert.ok(candidates[0].clicksTrend < 0);
  // Deterministic: identical second call.
  const res2 = await app("GET", `/projects/${P}/sites/${S}/refresh-candidates`);
  assert.deepEqual((res2.body as { data: unknown }).data, candidates);

  await store.close();
});

test("page-metrics record/list and content-score blend health, issues and trend", async () => {
  const { app, store } = await testApp();

  // Record additional measured-looking metrics (idempotent on conflict).
  const rec = await app("POST", `/projects/${P}/sites/${S}/page-metrics`, {
    metrics: [
      { url: "https://example.com/widget", metric: "clicks", value: 500, capturedAt: "2026-04-01T00:00:00.000Z" },
      { url: "https://example.com/widget", metric: "clicks", value: 200, capturedAt: "2026-06-01T00:00:00.000Z" }
    ]
  });
  assert.equal(rec.status, 201);
  assert.deepEqual((rec.body as { data: { inserted: number; updated: number } }).data, { inserted: 2, updated: 0 });

  const reRec = await app("POST", `/projects/${P}/sites/${S}/page-metrics`, {
    metrics: [{ url: "https://example.com/widget", metric: "clicks", value: 210, capturedAt: "2026-06-01T00:00:00.000Z" }]
  });
  assert.deepEqual((reRec.body as { data: { inserted: number; updated: number } }).data, { inserted: 0, updated: 1 });

  const listed = await app("GET", `/projects/${P}/sites/${S}/page-metrics?url=https://example.com/widget`);
  assert.equal((listed.body as { data: unknown[] }).data.length, 2);

  // Add an open issue on the URL to lower the score.
  await app("POST", `/projects/${P}/sites/${S}/audit-issues`, {
    issues: [{ id: "issue-widget", projectId: P, siteId: S, discoveredUrlId: null, url: "https://example.com/widget", rule: "missing_title", severity: "low", message: "x", detectedAt: "2026-06-02T00:00:00.000Z", resolvedAt: null }]
  });
  await app("POST", `/projects/${P}/sites/${S}/health-scores/compute`, {});

  const score = await app("GET", `/projects/${P}/sites/${S}/content-score?url=https://example.com/widget`);
  assert.equal(score.status, 200);
  const body = (score.body as { data: { score: number; openIssues: number; metricTrend: number; reasons: string[] } }).data;
  assert.equal(body.openIssues, 1);
  assert.ok(body.metricTrend < 0);
  assert.ok(body.score >= 0 && body.score <= 100);

  // Missing url query -> 400.
  const noUrl = await app("GET", `/projects/${P}/sites/${S}/content-score`);
  assert.equal(noUrl.status, 400);

  await store.close();
});

test("internal-link suggestions are derived from the real crawl link graph", async () => {
  const { app, store } = await testApp();

  // hub links to /target and /sibling. /target does not link to /sibling yet.
  await app("POST", `/projects/${P}/sites/${S}/internal-links`, {
    edges: [
      { fromUrl: "https://example.com/hub", toUrl: "https://example.com/target", anchor: "Target" },
      { fromUrl: "https://example.com/hub", toUrl: "https://example.com/sibling", anchor: "Sibling" }
    ]
  });

  const res = await app("GET", `/projects/${P}/sites/${S}/internal-link-suggestions?url=https://example.com/target`);
  assert.equal(res.status, 200);
  const suggestions = (res.body as { data: Array<{ url: string; reason: string }> }).data;
  // /sibling is co-linked from the hub and should be suggested.
  assert.ok(suggestions.some((s) => s.url === "https://example.com/sibling"));

  const noUrl = await app("GET", `/projects/${P}/sites/${S}/internal-link-suggestions`);
  assert.equal(noUrl.status, 400);

  await store.close();
});

test("brief -> proposal bridge creates a proposed dev_ticket on the proposal rail", async () => {
  const { app, store } = await testApp();

  const created = await app("POST", `/projects/${P}/sites/${S}/content-recommendations`, {
    url: "https://example.com/blog/seo-guide",
    title: "Refresh SEO guide",
    targetTopic: "seo",
    sections: ["Intro"]
  });
  const briefId = (created.body as { data: { id: string } }).data.id;

  const bridged = await app("POST", `/content-recommendations/${briefId}/create-proposal`, { kind: "dev_ticket" });
  assert.equal(bridged.status, 201);
  const proposal = (bridged.body as { data: { proposal: { id: string; kind: string; status: string; source: string; body: string } } }).data.proposal;
  assert.equal(proposal.kind, "dev_ticket");
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.source, "content_workspace");
  assert.ok(proposal.body.includes("https://example.com/blog/seo-guide"));

  // The proposal shows up on the project's proposal list.
  const list = await app("GET", `/projects/${P}/proposals`);
  assert.ok((list.body as { data: Array<{ id: string }> }).data.some((p) => p.id === proposal.id));

  await store.close();
});

test("unknown site / opportunity FK are validated", async () => {
  const { app, store } = await testApp();

  const badSite = await app("POST", `/projects/${P}/sites/site-missing/content-recommendations`, { url: "https://x", title: "t" });
  assert.equal(badSite.status, 404);

  const badOpp = await app("POST", `/projects/${P}/sites/${S}/content-recommendations`, { url: "https://x", title: "t", opportunityId: "opp-missing" });
  assert.equal(badOpp.status, 404);

  await store.close();
});
