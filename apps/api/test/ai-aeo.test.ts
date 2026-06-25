import assert from "node:assert/strict";
import test from "node:test";
import { analyzeAeo, computeAiVisibilityScore } from "@seo-tool/domain-model";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-6.1/6.2/6.3: AI Layer & MCP-Schreibtools (Welle 7). AI-Visibility (LLM-Stub, Klasse E — NIE
// Evidenz), AEO-Scan (Klasse A, speist aeo-Opportunities), reviewpflichtige Proposals.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/ai-aeo.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

const RICH = `<h1>Titel</h1><script type="application/ld+json">{}</script><h2>Was ist X?</h2><ul><li>a</li></ul><p>${"x".repeat(60)}</p>`;
const WEAK = `<div><p>kurz</p></div>`;

async function seedSite(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string) {
  const projectId = data<{ id: string }>(await app("POST", "/projects", { name: `AI ${slug}`, slug })).id;
  const siteId = data<{ id: string }>(await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://acme.example.com", scopeType: "domain" })).id;
  return { projectId, siteId };
}

test("analyzeAeo scores content checks (pure)", () => {
  assert.equal(analyzeAeo(RICH).score, 100);
  assert.equal(analyzeAeo(WEAK).score, 0);
  assert.equal(analyzeAeo("").score, 0);
});

test("computeAiVisibilityScore is the cited share (pure)", () => {
  assert.deepEqual(computeAiVisibilityScore([{ ourCited: true, brandMentioned: true }, { ourCited: false, brandMentioned: true }]), { prompts: 2, citedPrompts: 1, brandMentions: 2, score: 50 });
  assert.deepEqual(computeAiVisibilityScore([]), { prompts: 0, citedPrompts: 0, brandMentions: 0, score: 0 });
});

test("AI snapshots are tagged confidence class E and feed the visibility score", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId } = await seedSite(app, "vis");
    const prompt = data<{ id: string }>(await app("POST", `/projects/${projectId}/ai-prompts`, { prompt: "bestes seo tool" }));
    const snapshot = data<{ sourceConfidence: string; ourCited: boolean }>(await app("POST", `/projects/${projectId}/ai-prompts/${prompt.id}/snapshots`, {}));
    assert.equal(snapshot.sourceConfidence, "E", "LLM output is confidence class E");

    const visibility = data<{ prompts: number; score: number }>(await app("GET", `/projects/${projectId}/ai-visibility`));
    assert.equal(visibility.prompts, 1);
    assert.ok(visibility.score === 0 || visibility.score === 100);
  } finally {
    await store.close();
  }
});

test("AEO scan persists class-A assessments and a weak page generates an aeo opportunity with class-A evidence", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId } = await seedSite(app, "aeo");
    const weak = data<{ score: number; sourceConfidence: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/aeo/scan`, { url: "https://acme.example.com/thin", content: WEAK }));
    assert.equal(weak.score, 0);
    assert.equal(weak.sourceConfidence, "A", "AEO is content/crawl based -> class A");
    await app("POST", `/projects/${projectId}/sites/${siteId}/aeo/scan`, { url: "https://acme.example.com/good", content: RICH });

    const assessments = data<Array<{ url: string; score: number }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/aeo`));
    assert.equal(assessments.length, 2);

    // The umbrella generator now includes the aeo class; the weak page becomes an opportunity.
    const generated = data<{ opportunities: Array<{ type: string; affectedUrls: string[]; evidence: Array<{ sourceConfidence: string }> }> }>(await app("POST", `/projects/${projectId}/sites/${siteId}/opportunities/generate`, {}));
    const aeo = generated.opportunities.filter((opp) => opp.type === "aeo");
    assert.equal(aeo.length, 1, "only the weak page (score < 60) becomes an aeo opportunity");
    assert.deepEqual(aeo[0].affectedUrls, ["https://acme.example.com/thin"]);
    assert.ok(aeo[0].evidence.every((ev) => ev.sourceConfidence === "A"), "aeo evidence is class A, never the LLM class E");
  } finally {
    await store.close();
  }
});

test("proposals are review-gated: created as proposed, decided once", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId } = await seedSite(app, "prop");
    const proposal = data<{ id: string; status: string; kind: string }>(await app("POST", `/projects/${projectId}/proposals`, { kind: "dev_ticket", title: "Fix robots", body: "Resolve the indexability blocker" }));
    assert.equal(proposal.status, "proposed", "MCP write tools never mutate production directly");
    assert.equal(proposal.kind, "dev_ticket");

    const accepted = data<{ status: string }>(await app("POST", `/proposals/${proposal.id}/transition`, { status: "accepted" }));
    assert.equal(accepted.status, "accepted");

    const again = await app("POST", `/proposals/${proposal.id}/transition`, { status: "rejected" });
    assert.equal(again.status, 409, "a decided proposal cannot be re-decided");

    const list = data<unknown[]>(await app("GET", `/projects/${projectId}/proposals`));
    assert.equal(list.length, 1);
  } finally {
    await store.close();
  }
});

test("ai-prompt and proposal creation reject unknown projects", async () => {
  const { app, store } = await testApp();
  try {
    const missingPrompt = await app("POST", `/projects/proj-nope/ai-prompts`, { prompt: "x" });
    assert.equal(missingPrompt.status, 404);
    const missingProposal = await app("POST", `/projects/proj-nope/proposals`, { kind: "fix_pr", title: "t", body: "b" });
    assert.equal(missingProposal.status, 404);
  } finally {
    await store.close();
  }
});
