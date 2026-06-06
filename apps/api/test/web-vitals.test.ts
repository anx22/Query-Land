import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createSQLiteStore } from "../src/sqlite-store.js";

// WP-0.5: Web Vitals (Modul 2). Site-skopierter PageSpeed-Sync schreibt Web-Vitals als
// normalisierte Metriken (entity_type='site'); die Read-API liefert je Kennzahl den neuesten Wert.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/web-vitals.test.js

type ApiResponse = { status: number; body: unknown };

function testApp() {
  const store = createSQLiteStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function seed(app: ReturnType<typeof testApp>["app"], slug: string) {
  const project = data<{ id: string }>(await app("POST", "/projects", { name: `WV ${slug}`, slug }));
  const site = data<{ id: string }>(await app("POST", `/projects/${project.id}/sites`, { baseUrl: "https://wv.example.com", scopeType: "domain" }));
  const integration = data<{ id: string }>(await app("POST", "/integrations", { projectId: project.id, provider: "pagespeed" }));
  return { projectId: project.id, siteId: site.id, integrationId: integration.id };
}

type WebVital = { metric: string; value: number; sourceConfidence: string };

test("site-scoped PageSpeed sync produces web vitals that the read API returns", async () => {
  const { app, store } = testApp();
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
    store.close();
  }
});

test("repeated sync keeps one latest value per web-vital metric", async () => {
  const { app, store } = testApp();
  try {
    const { projectId, siteId, integrationId } = await seed(app, "latest");
    await app("POST", `/integrations/${integrationId}/sync`, { siteId });
    await app("POST", `/integrations/${integrationId}/sync`, { siteId });
    const vitals = data<WebVital[]>(await app("GET", `/projects/${projectId}/sites/${siteId}/web-vitals`));
    assert.equal(vitals.length, 4, "latest-per-metric, not duplicated across runs");
  } finally {
    store.close();
  }
});

test("project-scoped sync does not populate site web vitals", async () => {
  const { app, store } = testApp();
  try {
    const { projectId, siteId, integrationId } = await seed(app, "project-scope");
    await app("POST", `/integrations/${integrationId}/sync`); // no siteId -> project scope
    assert.deepEqual(data<WebVital[]>(await app("GET", `/projects/${projectId}/sites/${siteId}/web-vitals`)), []);
  } finally {
    store.close();
  }
});
