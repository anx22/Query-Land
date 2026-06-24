import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createSQLiteStore } from "../src/sqlite-store.js";

// Welle-1-Gate-Smoke (WP-0.2): beweist den Foundation-Flow end-to-end gegen die echten
// API-Routen (nicht Fixtures): Projekt anlegen -> Site anlegen -> Connector-Stub anlegen ->
// Crawl starten -> Job sichtbar -> erneuter Read (frischer Handler, gleiche DB) hält die Daten.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/foundation-smoke.test.js

type ApiResponse = { status: number; body: unknown };
type DataBody<T> = { data: T };

function dataOf<T>(response: ApiResponse): T {
  return (response.body as DataBody<T>).data;
}

test("Welle-1 Foundation-Gate: project -> site -> connector -> crawl -> job -> reload persists", async () => {
  const store = await createSQLiteStore("sqlite::memory:");
  const app = createApp(store);

  // 1. Projekt anlegen
  const projectRes = await app("POST", "/projects", {
    name: "Smoke Foundation",
    slug: "smoke-foundation",
    defaultLocale: "de-DE",
    markets: []
  });
  assert.equal(projectRes.status, 201, "project create should return 201");
  const project = dataOf<{ id: string; slug: string }>(projectRes);
  assert.equal(project.slug, "smoke-foundation");

  // 2. Site anlegen
  const siteRes = await app("POST", `/projects/${project.id}/sites`, {
    baseUrl: "https://smoke.example.com",
    scopeType: "domain",
    crawlFrequency: "weekly",
    businessValue: 80
  });
  assert.equal(siteRes.status, 201, "site create should return 201");
  const site = dataOf<{ id: string; baseUrl: string }>(siteRes);
  assert.equal(site.baseUrl, "https://smoke.example.com");

  // 3. Connector-Stub (GSC) anlegen
  const integrationRes = await app("POST", "/integrations", {
    projectId: project.id,
    provider: "gsc"
  });
  assert.equal(integrationRes.status, 201, "integration create should return 201");
  assert.equal(dataOf<{ provider: string }>(integrationRes).provider, "gsc");

  // 4. Crawl starten (erzeugt Crawl Run + crawl_seed Job)
  const scheduleRes = await app("POST", `/projects/${project.id}/sites/${site.id}/crawl-runs/schedule`, {
    trigger: "manual",
    baseUrl: site.baseUrl
  });
  assert.equal(scheduleRes.status, 201, "crawl schedule should return 201");
  const scheduled = dataOf<{ crawlRun: { id: string }; job: { type: string } }>(scheduleRes);
  assert.equal(scheduled.job.type, "crawl_seed");

  // 5. Job sichtbar in der Queue
  const jobsRes = await app("GET", "/jobs");
  assert.equal(jobsRes.status, 200);
  const jobs = dataOf<Array<{ projectId: string; type: string }>>(jobsRes);
  assert.ok(
    jobs.some((job) => job.projectId === project.id && job.type === "crawl_seed"),
    "scheduled crawl_seed job should be visible in /jobs"
  );

  // 6. "Reload": frischer Handler auf derselben DB -> Daten bleiben erhalten
  const reloaded = createApp(store);

  const projectsAfter = dataOf<Array<{ id: string }>>(await reloaded("GET", "/projects"));
  assert.ok(projectsAfter.some((p) => p.id === project.id), "project persists after reload");

  const sitesAfter = dataOf<Array<{ id: string }>>(await reloaded("GET", `/projects/${project.id}/sites`));
  assert.ok(sitesAfter.some((s) => s.id === site.id), "site persists after reload");

  const integrationsAfter = dataOf<Array<{ projectId: string; provider: string }>>(await reloaded("GET", "/integrations"));
  assert.ok(
    integrationsAfter.some((i) => i.projectId === project.id && i.provider === "gsc"),
    "integration persists after reload"
  );

  const jobsAfter = dataOf<Array<{ projectId: string; type: string }>>(await reloaded("GET", "/jobs"));
  assert.ok(
    jobsAfter.some((job) => job.projectId === project.id && job.type === "crawl_seed"),
    "job persists after reload"
  );
});
