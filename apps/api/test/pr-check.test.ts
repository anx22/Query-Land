import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createSQLiteStore } from "../src/sqlite-store.js";

// WP-3.3: Source-Map Pre-Merge-Gate (§4.3). Geänderte Repo-Pfade -> betroffene Templates/URL-Muster
// -> verknüpfte offene Opportunities; Status passed | review_required | unmapped, mit Verlauf.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/pr-check.test.js

type ApiResponse = { status: number; body: unknown };

function testApp() {
  const store = createSQLiteStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

const BASE = "https://acme.test";

async function setup(app: ReturnType<typeof testApp>["app"]) {
  const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "Gate", slug: "gate" })).id;
  await app("POST", `/projects/${projectId}/sites`, { baseUrl: BASE, scopeType: "domain" });
  // Map two URLs to templates.
  await app("POST", "/source-map", { projectId, repoUrl: "https://github.com/acme/site", urlPattern: `${BASE}/pricing`, templateName: "pricing", component: "PricingPage", repoPath: "src/templates/pricing.tsx", confidence: "exact" });
  await app("POST", "/source-map", { projectId, repoUrl: "https://github.com/acme/site", urlPattern: `${BASE}/about`, templateName: "about", component: "AboutPage", repoPath: "src/templates/about.tsx", confidence: "exact" });
  return projectId;
}

async function createOpportunity(app: ReturnType<typeof testApp>["app"], projectId: string, overrides: Record<string, unknown>) {
  const base = {
    type: "money_page",
    affectedUrls: [`${BASE}/pricing`],
    currentState: "underperforming",
    recommendedAction: "improve snippet",
    expectedImpact: 3, effort: 2, confidence: 0.6, businessValue: 50, urgency: 3,
    validationMetric: "ctr",
    evidence: [{ source: "gsc", sourceConfidence: "B", metric: "ctr", beforeValue: 0.01, currentValue: 0.01, timeWindow: "2026-06-06", affectedEntity: `${BASE}/pricing` }]
  };
  return data<{ id: string }>(await app("POST", `/projects/${projectId}/opportunities`, { ...base, ...overrides }));
}

test("pr-check flags review_required when a changed path maps to a URL with an open opportunity", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await setup(app);
    await createOpportunity(app, projectId, {});

    const result = await app("POST", `/projects/${projectId}/pr-checks`, { changedPaths: ["src/templates/pricing.tsx"], prNumber: 42 });
    assert.equal(result.status, 201);
    const gate = data<{ status: string; prNumber: number; affectedTemplates: Array<{ urlPattern: string }>; affectedUrlPatterns: string[]; relatedOpportunities: Array<{ matchedBy: string }> }>(result);
    assert.equal(gate.status, "review_required");
    assert.equal(gate.prNumber, 42);
    assert.deepEqual(gate.affectedUrlPatterns, [`${BASE}/pricing`]);
    assert.equal(gate.relatedOpportunities.length, 1);
    assert.equal(gate.relatedOpportunities[0].matchedBy, "url_pattern");

    const history = data<unknown[]>(await app("GET", `/projects/${projectId}/pr-checks`));
    assert.equal(history.length, 1, "pr-check result is persisted as history");
  } finally {
    store.close();
  }
});

test("pr-check passes when a mapped path has no open opportunities", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await setup(app);
    const gate = data<{ status: string; affectedTemplates: unknown[]; relatedOpportunities: unknown[] }>(await app("POST", `/projects/${projectId}/pr-checks`, { changedPaths: ["src/templates/about.tsx"] }));
    assert.equal(gate.status, "passed");
    assert.equal(gate.affectedTemplates.length, 1);
    assert.equal(gate.relatedOpportunities.length, 0);
  } finally {
    store.close();
  }
});

test("pr-check reports unmapped when no changed path resolves via the source map", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await setup(app);
    const gate = data<{ status: string; affectedTemplates: unknown[] }>(await app("POST", `/projects/${projectId}/pr-checks`, { changedPaths: ["src/lib/unrelated.ts"] }));
    assert.equal(gate.status, "unmapped");
    assert.equal(gate.affectedTemplates.length, 0);
  } finally {
    store.close();
  }
});

test("pr-check matches an opportunity by its source anchor repository path", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await setup(app);
    // Opportunity whose URL is NOT mapped, but carries a source anchor on a changed path.
    await createOpportunity(app, projectId, {
      type: "technical_fix",
      affectedUrls: [`${BASE}/checkout`],
      validationMetric: "indexable",
      sourceAnchor: { repositoryPath: "src/templates/checkout.tsx", templateName: "checkout", confidence: "manifest" }
    });

    const gate = data<{ status: string; relatedOpportunities: Array<{ matchedBy: string }> }>(await app("POST", `/projects/${projectId}/pr-checks`, { changedPaths: ["src/templates/checkout.tsx"] }));
    assert.equal(gate.status, "review_required");
    assert.equal(gate.relatedOpportunities.length, 1);
    assert.equal(gate.relatedOpportunities[0].matchedBy, "source_anchor");
  } finally {
    store.close();
  }
});

test("pr-check requires a non-empty changedPaths array", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await setup(app);
    const empty = await app("POST", `/projects/${projectId}/pr-checks`, { changedPaths: [] });
    assert.equal(empty.status, 400);
    assert.equal((empty.body as { error: { code: string } }).error.code, "missing_field");
  } finally {
    store.close();
  }
});
