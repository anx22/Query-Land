import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-1.2: Opportunity-Rueckgrat (§6). Beweist Anlage mit Evidenz-Pflicht (§2.3),
// Prioritaetsscore (§6.4), Filter/Pagination und das Statusmodell §6.5.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/opportunities.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function freshProject(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string): Promise<string> {
  return data<{ id: string }>(await app("POST", "/projects", { name: `Opp ${slug}`, slug })).id;
}

const baseInput = {
  type: "technical_fix",
  currentState: "Pricing page carries noindex",
  recommendedAction: "Remove noindex from the pricing template and re-crawl",
  expectedImpact: 4,
  effort: 2,
  confidence: 0.8,
  businessValue: 9,
  urgency: 3,
  validationMetric: "indexable",
  affectedUrls: ["https://example.com/pricing"],
  evidence: [
    { source: "crawl", sourceConfidence: "A", metric: "indexable", beforeValue: "false", currentValue: "false", timeWindow: "2026-06-01..2026-06-06", affectedEntity: "https://example.com/pricing" }
  ]
};

test("create opportunity computes priority, stores evidence, defaults to open", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "create");
    const created = await app("POST", `/projects/${projectId}/opportunities`, baseInput);
    assert.equal(created.status, 201);
    const opp = data<{ id: string; status: string; priority: number; evidence: unknown[]; type: string }>(created);
    assert.equal(opp.status, "open");
    assert.equal(opp.type, "technical_fix");
    assert.equal(opp.evidence.length, 1);
    // §6.4: round(impact*confidence*businessValue*urgency*100/effort) = round(4*0.8*9*3*100/2) = 4320
    assert.equal(opp.priority, 4320);

    const fetched = data<{ id: string }>(await app("GET", `/opportunities/${opp.id}`));
    assert.equal(fetched.id, opp.id);
  } finally {
    await store.close();
  }
});

test("create opportunity requires evidence of confidence class A-C", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "evidence");
    const noEvidence = await app("POST", `/projects/${projectId}/opportunities`, { ...baseInput, evidence: [] });
    assert.equal(noEvidence.status, 400);
    assert.equal((noEvidence.body as { error: { code: string } }).error.code, "evidence_required");

    const weakEvidence = await app("POST", `/projects/${projectId}/opportunities`, {
      ...baseInput,
      evidence: [{ source: "llm", sourceConfidence: "E", metric: "guess", beforeValue: "x", currentValue: "y", timeWindow: "n/a", affectedEntity: "url" }]
    });
    assert.equal(weakEvidence.status, 400);
    assert.equal((weakEvidence.body as { error: { code: string } }).error.code, "evidence_confidence_too_low");
  } finally {
    await store.close();
  }
});

test("create opportunity rejects non-positive effort via priority formula", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "effort");
    const bad = await app("POST", `/projects/${projectId}/opportunities`, { ...baseInput, effort: 0 });
    assert.equal(bad.status, 400);
    assert.equal((bad.body as { error: { code: string } }).error.code, "validation_error");
  } finally {
    await store.close();
  }
});

test("list opportunities supports status and type filters, ordered by priority", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "list");
    const low = data<{ id: string }>(await app("POST", `/projects/${projectId}/opportunities`, { ...baseInput, businessValue: 1 }));
    const high = data<{ id: string }>(await app("POST", `/projects/${projectId}/opportunities`, { ...baseInput, businessValue: 9 }));

    const all = data<Array<{ id: string }>>(await app("GET", `/projects/${projectId}/opportunities?limit=10`));
    assert.equal(all.length, 2);
    assert.equal(all[0]?.id, high.id, "higher priority comes first");

    // No technical_fix? there are; filter by a type with none:
    const none = data<Array<{ id: string }>>(await app("GET", `/projects/${projectId}/opportunities?type=money_page`));
    assert.equal(none.length, 0);

    const openOnly = data<Array<{ id: string }>>(await app("GET", `/projects/${projectId}/opportunities?status=open`));
    assert.equal(openOnly.length, 2);
    assert.ok(openOnly.some((o) => o.id === low.id));
  } finally {
    await store.close();
  }
});

test("status transitions follow the §6.5 lifecycle and reject illegal jumps", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "lifecycle");
    const opp = data<{ id: string }>(await app("POST", `/projects/${projectId}/opportunities`, baseInput));

    // Illegal jump open -> validated.
    const illegal = await app("POST", `/opportunities/${opp.id}/transition`, { status: "validated" });
    assert.equal(illegal.status, 409);
    assert.equal((illegal.body as { error: { code: string } }).error.code, "invalid_transition");

    // Legal path open -> in_progress -> implemented -> validated.
    assert.equal(data<{ status: string }>(await app("POST", `/opportunities/${opp.id}/transition`, { status: "in_progress" })).status, "in_progress");
    assert.equal(data<{ status: string }>(await app("POST", `/opportunities/${opp.id}/transition`, { status: "implemented" })).status, "implemented");
    assert.equal(data<{ status: string }>(await app("POST", `/opportunities/${opp.id}/transition`, { status: "validated" })).status, "validated");

    // validated -> reopened allowed; validated -> in_progress not.
    const badReopen = await app("POST", `/opportunities/${opp.id}/transition`, { status: "in_progress" });
    assert.equal(badReopen.status, 409);
    assert.equal(data<{ status: string }>(await app("POST", `/opportunities/${opp.id}/transition`, { status: "reopened" })).status, "reopened");
  } finally {
    await store.close();
  }
});

test("reaching 'implemented' schedules an async revalidation job (§6.5 loop)", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "reval-schedule");
    const opp = data<{ id: string }>(await app("POST", `/projects/${projectId}/opportunities`, baseInput));
    await app("POST", `/opportunities/${opp.id}/transition`, { status: "in_progress" });
    await app("POST", `/opportunities/${opp.id}/transition`, { status: "implemented" });

    // The transition enqueued an opportunity_revalidate job the cron drains.
    const claimed = data<{ id: string; type: string; payload: Record<string, unknown> } | null>(await app("POST", "/jobs/claim", { type: "opportunity_revalidate" }));
    assert.ok(claimed, "an opportunity_revalidate job was enqueued");
    assert.equal(claimed!.type, "opportunity_revalidate");
    assert.equal(claimed!.payload.opportunityId, opp.id);
  } finally {
    await store.close();
  }
});

test("revalidating with no fresh evidence keeps the opportunity 'implemented' (pending, no error)", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "reval-pending");
    const opp = data<{ id: string }>(await app("POST", `/projects/${projectId}/opportunities`, baseInput));
    await app("POST", `/opportunities/${opp.id}/transition`, { status: "in_progress" });
    await app("POST", `/opportunities/${opp.id}/transition`, { status: "implemented" });

    // No crawl/indexability evidence exists for the URL yet → stays implemented, no error (async latency §2.10).
    const revalidated = await app("POST", `/opportunities/${opp.id}/revalidate`);
    assert.equal(revalidated.status, 200);
    assert.equal(data<{ status: string }>(revalidated).status, "implemented");
  } finally {
    await store.close();
  }
});
