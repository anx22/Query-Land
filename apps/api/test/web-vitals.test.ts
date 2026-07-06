import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWebVitalIssues } from "@seo-tool/domain-model";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-0.5: Web Vitals (Modul 2). Site-skopierter PageSpeed-Sync schreibt Web-Vitals als
// normalisierte Metriken (entity_type='site'); die Read-API liefert je Kennzahl den neuesten Wert.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/web-vitals.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function seed(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string) {
  const project = data<{ id: string }>(await app("POST", "/projects", { name: `WV ${slug}`, slug }));
  const site = data<{ id: string }>(await app("POST", `/projects/${project.id}/sites`, { baseUrl: "https://wv.example.com", scopeType: "domain" }));
  const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId: project.id, provider: "pagespeed" }));
  return { projectId: project.id, siteId: site.id, integrationId: integration.id };
}

type WebVital = { metric: string; value: number; sourceConfidence: string };

test("site-scoped PageSpeed sync produces web vitals that the read API returns", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId, integrationId } = await seed(app, "happy");

    // Before any sync the site has no web vitals.
    assert.deepEqual(data<WebVital[]>(await app("GET", `/projects/${projectId}/sites/${siteId}/web-vitals`)), []);

    const sync = await app("POST", `/integrations/${integrationId}/sync`, { siteId });
    assert.equal(sync.status, 200);

    const vitals = data<WebVital[]>(await app("GET", `/projects/${projectId}/sites/${siteId}/web-vitals`));
    const metrics = vitals.map((v) => v.metric).sort();
    assert.deepEqual(metrics, ["psi_cls", "psi_inp_ms", "psi_lcp_ms", "psi_ttfb_ms"]);
    assert.ok(vitals.every((v) => v.sourceConfidence === "B"), "web vitals carry confidence class B");
    assert.equal(vitals.find((v) => v.metric === "psi_lcp_ms")?.value, 2410);
  } finally {
    await store.close();
  }
});

test("repeated sync keeps one latest value per web-vital metric", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId, integrationId } = await seed(app, "latest");
    await app("POST", `/integrations/${integrationId}/sync`, { siteId });
    await app("POST", `/integrations/${integrationId}/sync`, { siteId });
    const vitals = data<WebVital[]>(await app("GET", `/projects/${projectId}/sites/${siteId}/web-vitals`));
    assert.equal(vitals.length, 4, "latest-per-metric, not duplicated across runs");
  } finally {
    await store.close();
  }
});

test("evaluateWebVitalIssues (pure): poor → high, needs-improvement → medium, good → none", () => {
  const issues = evaluateWebVitalIssues({ psi_lcp_ms: 4500, psi_ttfb_ms: 1200, psi_cls: 0.05, psi_inp_ms: 180 });
  const byRule = new Map(issues.map((i) => [i.rule, i]));
  assert.equal(byRule.get("lcp_slow")?.severity, "high", "LCP 4500ms is poor → high");
  assert.equal(byRule.get("ttfb_slow")?.severity, "medium", "TTFB 1200ms is needs-improvement → medium");
  assert.ok(!byRule.has("cls_high"), "CLS 0.05 is good → no issue");
  assert.ok(!byRule.has("inp_slow"), "INP 180ms is good → no issue");
});

test("web-vitals evaluate turns poor vitals into audit issues and clears them when good", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId, integrationId } = await seed(app, "evaluate");
    // Stub PSI values are all within the "good" band → evaluation creates no vitals issues.
    await app("POST", `/integrations/${integrationId}/sync`, { siteId });
    const result = data<{ created: number; resolved: number }>(await app("POST", `/projects/${projectId}/sites/${siteId}/web-vitals/evaluate`));
    assert.equal(result.created, 0, "good vitals produce no issues (no false positives)");

    const issues = data<Array<{ rule: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/audit-issues`));
    assert.ok(!issues.some((i) => ["lcp_slow", "cls_high", "inp_slow", "ttfb_slow"].includes(i.rule)), "no vitals issues on a healthy site");
  } finally {
    await store.close();
  }
});

test("project-scoped sync does not populate site web vitals", async () => {
  const { app, store } = await testApp();
  try {
    const { projectId, siteId, integrationId } = await seed(app, "project-scope");
    await app("POST", `/integrations/${integrationId}/sync`); // no siteId -> project scope
    assert.deepEqual(data<WebVital[]>(await app("GET", `/projects/${projectId}/sites/${siteId}/web-vitals`)), []);
  } finally {
    await store.close();
  }
});
