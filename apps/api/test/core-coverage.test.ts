import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";
import { seedDemoFoundation } from "./helpers/demo-foundation.js";

// WP-0.7 (Teil: Testabdeckung Kernlogik). Die Inventur fand nur ~20% der Routen getestet.
// Diese Suite deckt die bisher ungetesteten Kernpfade ab: Project/Site-CRUD inkl. Duplicate,
// Crawl-Run-Lifecycle + Status-Filter, Audit-Issue-Filter + resolve/dismiss/reopen, Health-Score-Compute.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/core-coverage.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  await seedDemoFoundation(store);
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

test("project and site CRUD persist and duplicate slug is rejected with 409", async () => {
  const { app, store } = await testApp();
  try {
    const created = await app("POST", "/projects", { name: "Core Coverage", slug: "core-cov", defaultLocale: "de-DE", markets: [] });
    assert.equal(created.status, 201);
    const project = data<{ id: string }>(created);
    assert.equal(project.id, "proj-core-cov");

    const projects = data<Array<{ id: string }>>(await app("GET", "/projects"));
    assert.ok(projects.some((p) => p.id === project.id));

    const site = data<{ id: string }>(await app("POST", `/projects/${project.id}/sites`, {
      baseUrl: "https://core.example.com", scopeType: "domain", crawlFrequency: "weekly", businessValue: 70
    }));
    const sites = data<Array<{ id: string; baseUrl: string }>>(await app("GET", `/projects/${project.id}/sites`));
    assert.ok(sites.some((s) => s.id === site.id && s.baseUrl === "https://core.example.com"));

    const duplicate = await app("POST", "/projects", { name: "Dup", slug: "core-cov" });
    assert.equal(duplicate.status, 409);
    assert.equal((duplicate.body as { error: { code: string } }).error.code, "duplicate_project_slug");
  } finally {
    await store.close();
  }
});

test("crawl run lifecycle transitions running -> succeeded and is filterable by status", async () => {
  const { app, store } = await testApp();
  try {
    const running = data<{ id: string; status: string }>(await app("POST", "/projects/proj-demo/sites/site-demo/crawl-runs", { trigger: "manual" }));
    assert.equal(running.status, "running");

    const second = data<{ id: string }>(await app("POST", "/projects/proj-demo/sites/site-demo/crawl-runs", { trigger: "deploy" }));
    const completed = await app("POST", `/projects/proj-demo/sites/site-demo/crawl-runs/${second.id}/complete`, { status: "succeeded" });
    assert.equal(completed.status, 200);
    assert.equal(data<{ status: string }>(completed).status, "succeeded");

    const succeeded = data<Array<{ id: string; status: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/crawl-runs?status=succeeded&limit=20"));
    assert.ok(succeeded.every((run) => run.status === "succeeded"));
    assert.ok(succeeded.some((run) => run.id === second.id));

    const stillRunning = data<Array<{ id: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/crawl-runs?status=running&limit=20"));
    assert.ok(stillRunning.some((run) => run.id === running.id));
  } finally {
    await store.close();
  }
});

test("audit issue filtering and resolve/dismiss/reopen state transitions", async () => {
  const { app, store } = await testApp();
  try {
    await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
      urls: [{ id: "url-cov", projectId: "proj-demo", siteId: "site-demo", url: "https://example.com/cov", normalizedUrl: "https://example.com/cov", source: "sitemap", discoveredFrom: null, depth: 1, discoveredAt: "2026-06-02T08:00:00.000Z" }]
    });
    await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
      checkedDiscoveredUrlIds: ["url-cov"],
      issues: [{ id: "issue-cov", projectId: "proj-demo", siteId: "site-demo", discoveredUrlId: "url-cov", url: "https://example.com/cov", rule: "http_error", severity: "critical", message: "Server error", detectedAt: "2026-06-02T08:05:00.000Z", resolvedAt: null }]
    });

    const open = data<Array<{ id: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues?status=open&limit=20"));
    assert.ok(open.some((i) => i.id === "issue-cov"));

    const resolved = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues/issue-cov/resolve");
    assert.equal(resolved.status, 200);
    assert.notEqual(data<{ resolvedAt: string | null }>(resolved).resolvedAt, null);

    const afterResolveOpen = data<Array<{ id: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues?status=open&limit=20"));
    assert.ok(!afterResolveOpen.some((i) => i.id === "issue-cov"));
    const afterResolveResolved = data<Array<{ id: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues?status=resolved&limit=20"));
    assert.ok(afterResolveResolved.some((i) => i.id === "issue-cov"));

    const reopened = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues/issue-cov/reopen");
    assert.equal(data<{ resolvedAt: string | null }>(reopened).resolvedAt, null);
    const afterReopen = data<Array<{ id: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues?status=open&limit=20"));
    assert.ok(afterReopen.some((i) => i.id === "issue-cov"));

    const dismissed = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues/issue-cov/dismiss");
    assert.equal(dismissed.status, 200);
    // Dismiss is a distinct state: dismissed_at set, resolved_at stays null, but
    // the issue leaves the open set (and appears under the resolved/closed filter).
    assert.equal(data<{ resolvedAt: string | null }>(dismissed).resolvedAt, null);
    assert.notEqual(data<{ dismissedAt: string | null }>(dismissed).dismissedAt, null);
    const afterDismissOpen = data<Array<{ id: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues?status=open&limit=20"));
    assert.ok(!afterDismissOpen.some((i) => i.id === "issue-cov"));
    const afterDismissClosed = data<Array<{ id: string }>>(await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues?status=resolved&limit=20"));
    assert.ok(afterDismissClosed.some((i) => i.id === "issue-cov"));
  } finally {
    await store.close();
  }
});

test("health score compute reflects open issues and recovers after resolution", async () => {
  const { app, store } = await testApp();
  try {
    const project = data<{ id: string }>(await app("POST", "/projects", { name: "Health Cov", slug: "health-cov" }));
    const site = data<{ id: string }>(await app("POST", `/projects/${project.id}/sites`, { baseUrl: "https://health.example.com", scopeType: "domain" }));
    const base = `/projects/${project.id}/sites/${site.id}`;

    const clean = data<{ score: number }>(await app("POST", `${base}/health-scores/compute`));
    assert.equal(clean.score, 100, "a site without open issues should score 100");

    await app("POST", `${base}/discovered-urls`, {
      urls: [{ id: "url-h", projectId: project.id, siteId: site.id, url: "https://health.example.com/x", normalizedUrl: "https://health.example.com/x", source: "sitemap", discoveredFrom: null, depth: 1, discoveredAt: "2026-06-02T08:00:00.000Z" }]
    });
    await app("POST", `${base}/audit-issues`, {
      checkedDiscoveredUrlIds: ["url-h"],
      issues: [{ id: "issue-h", projectId: project.id, siteId: site.id, discoveredUrlId: "url-h", url: "https://health.example.com/x", rule: "http_error", severity: "critical", message: "Server error", detectedAt: "2026-06-02T08:05:00.000Z", resolvedAt: null }]
    });

    const degraded = data<{ score: number }>(await app("POST", `${base}/health-scores/compute`));
    assert.ok(degraded.score < 100, "an open critical issue must lower the score");
    assert.ok(degraded.score >= 0, "score stays within bounds");

    await app("POST", `${base}/audit-issues/issue-h/resolve`);
    const recovered = data<{ score: number }>(await app("POST", `${base}/health-scores/compute`));
    assert.ok(recovered.score > degraded.score, "resolving the issue must improve the score");
  } finally {
    await store.close();
  }
});
