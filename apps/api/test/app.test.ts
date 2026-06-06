import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { createApp } from "../src/app.js";
import { createSQLiteStore } from "../src/sqlite-store.js";
import { runSQLiteMigrations } from "../src/sqlite-migrations.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (location: string) => { exec(sql: string): void; prepare(sql: string): { run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }; get(...params: unknown[]): Record<string, unknown> | undefined; all(...params: unknown[]): Array<Record<string, unknown>> }; close(): void };
};

function testApp() {
  const store = createSQLiteStore("sqlite::memory:");
  return { app: createApp(store), store };
}

test("SQLite migrations are versioned and idempotent", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const first = runSQLiteMigrations(db);
    assert.deepEqual(first.applied.map((migration) => migration.filename), ["001_foundation_auth.sql", "002_rebuild_indexability_state_constraint.sql", "003_internal_link_edges.sql", "004_opportunities.sql", "005_keywords.sql", "006_rank_serp.sql", "007_visibility.sql", "008_search_performance.sql", "009_pr_checks.sql", "010_backlinks.sql", "011_reporting.sql", "012_ai_aeo.sql"]);
    assert.deepEqual(first.skipped, []);

    const recorded = db.prepare(`SELECT version, name FROM schema_migrations ORDER BY version`).all()
      .map((row) => ({ version: row.version, name: row.name }));
    assert.deepEqual(recorded, [
      { version: 1, name: "foundation_auth" },
      { version: 2, name: "rebuild_indexability_state_constraint" },
      { version: 3, name: "internal_link_edges" },
      { version: 4, name: "opportunities" },
      { version: 5, name: "keywords" },
      { version: 6, name: "rank_serp" },
      { version: 7, name: "visibility" },
      { version: 8, name: "search_performance" },
      { version: 9, name: "pr_checks" },
      { version: 10, name: "backlinks" },
      { version: 11, name: "reporting" },
      { version: 12, name: "ai_aeo" }
    ]);

    const second = runSQLiteMigrations(db);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.skipped.map((migration) => migration.filename), ["001_foundation_auth.sql", "002_rebuild_indexability_state_constraint.sql", "003_internal_link_edges.sql", "004_opportunities.sql", "005_keywords.sql", "006_rank_serp.sql", "007_visibility.sql", "008_search_performance.sql", "009_pr_checks.sql", "010_backlinks.sql", "011_reporting.sql", "012_ai_aeo.sql"]);
  } finally {
    db.close();
  }
});


test("SQLite migrations rebuild legacy indexability CHECK constraint for robots state", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL, default_locale TEXT NOT NULL, markets TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE sites (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, scope_type TEXT NOT NULL, base_url TEXT NOT NULL, crawl_frequency TEXT NOT NULL, business_value INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE discovered_urls (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, url TEXT NOT NULL, normalized_url TEXT NOT NULL, source TEXT NOT NULL, discovered_from TEXT, depth INTEGER NOT NULL, discovered_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE url_fetch_results (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, discovered_url_id TEXT NOT NULL REFERENCES discovered_urls(id) ON DELETE CASCADE, url TEXT NOT NULL, final_url TEXT NOT NULL, status_code INTEGER, status_class TEXT NOT NULL, headers TEXT NOT NULL, redirect_chain TEXT NOT NULL, fetched_at TEXT NOT NULL, error_message TEXT, created_at TEXT NOT NULL);
CREATE TABLE url_indexability_assessments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  discovered_url_id TEXT NOT NULL REFERENCES discovered_urls(id) ON DELETE CASCADE,
  fetch_result_id TEXT REFERENCES url_fetch_results(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('indexable', 'blocked_by_status', 'blocked_by_meta', 'blocked_by_x_robots', 'canonicalized')),
  is_indexable INTEGER NOT NULL CHECK (is_indexable IN (0, 1)),
  reasons TEXT NOT NULL DEFAULT '[]',
  canonical_url TEXT,
  assessed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);
    db.prepare(`INSERT INTO projects (id, name, slug, status, default_locale, markets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run("proj-legacy", "Legacy", "legacy", "active", "de-DE", "[]", "2026-06-04T00:00:00.000Z", "2026-06-04T00:00:00.000Z");
    db.prepare(`INSERT INTO sites (id, project_id, scope_type, base_url, crawl_frequency, business_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("site-legacy", "proj-legacy", "domain", "https://example.com", "weekly", 80, "2026-06-04T00:00:00.000Z");
    db.prepare(`INSERT INTO discovered_urls (id, project_id, site_id, url, normalized_url, source, discovered_from, depth, discovered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("url-legacy", "proj-legacy", "site-legacy", "https://example.com/robots-blocked", "https://example.com/robots-blocked", "sitemap", null, 1, "2026-06-04T00:00:00.000Z", "2026-06-04T00:00:00.000Z");
    db.prepare(`INSERT INTO url_indexability_assessments (id, project_id, site_id, discovered_url_id, fetch_result_id, url, state, is_indexable, reasons, canonical_url, assessed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("idx-existing", "proj-legacy", "site-legacy", "url-legacy", null, "https://example.com/", "indexable", 1, "[]", null, "2026-06-04T00:00:00.000Z", "2026-06-04T00:00:00.000Z");

    runSQLiteMigrations(db);

    db.prepare(`INSERT INTO url_indexability_assessments (id, project_id, site_id, discovered_url_id, fetch_result_id, url, state, is_indexable, reasons, canonical_url, assessed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("idx-robots", "proj-legacy", "site-legacy", "url-legacy", null, "https://example.com/robots-blocked", "blocked_by_robots", 0, "[\"robots.txt disallows URL\"]", null, "2026-06-04T00:01:00.000Z", "2026-06-04T00:01:00.000Z");
    const states = db.prepare(`SELECT state FROM url_indexability_assessments ORDER BY id`).all().map((row) => row.state);
    assert.deepEqual(states, ["indexable", "blocked_by_robots"]);
  } finally {
    db.close();
  }
});

test("GET /health returns embedded SQLite foundation health snapshot", async () => {
  const { app, store } = testApp();
  const response = await app("GET", "/health");
  assert.equal(response.status, 200);
  const body = response.body as { status: string; checks: Array<{ name: string }> };
  assert.equal(body.status, "ok");
  assert.ok(body.checks.some((check) => check.name === "sqlite"));
  store.close();
});

test("POST /jobs is persisted and idempotent by project/type/subject", async () => {
  const { app, store } = testApp();
  const body = { projectId: "proj-demo", type: "health_check", subject: "daily" };
  const first = await app("POST", "/jobs", body);
  const second = await app("POST", "/jobs", body);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((second.body as { idempotent: boolean }).idempotent, true);
  store.close();
});

test("job queue claims a queued job exactly once and completes it", () => {
  const store = createSQLiteStore("sqlite::memory:");
  store.createJob("proj-demo", "health_check", "claim-me");
  const claimed = store.claimNextJob();
  assert.equal(claimed?.status, "running");
  assert.equal(claimed?.attempts, 1);
  const completed = store.completeJob(claimed!.id, "succeeded");
  assert.equal(completed.status, "succeeded");
  store.close();
});

test("Welle 1 UI smoke persists project, site, connector stub and job through API reads", async () => {
  const { app, store } = testApp();

  const projectResponse = await app("POST", "/projects", {
    name: "Welle 1 Smoke",
    slug: "welle-1-smoke",
    status: "active",
    defaultLocale: "de-DE",
    markets: [
      { country: "DE", language: "de", device: "desktop", searchEngine: "google" }
    ]
  });
  assert.equal(projectResponse.status, 201);
  const project = (projectResponse.body as { data: { id: string; slug: string } }).data;
  assert.equal(project.slug, "welle-1-smoke");

  const siteResponse = await app("POST", `/projects/${project.id}/sites`, {
    baseUrl: "https://welle-1.example/",
    scopeType: "domain",
    crawlFrequency: "weekly",
    businessValue: 80
  });
  assert.equal(siteResponse.status, 201);
  const site = (siteResponse.body as { data: { id: string; projectId: string; baseUrl: string } }).data;
  assert.equal(site.projectId, project.id);
  assert.equal(site.baseUrl, "https://welle-1.example/");

  const connectorResponse = await app("POST", "/integrations", {
    projectId: project.id,
    provider: "gsc"
  });
  assert.equal(connectorResponse.status, 201);
  const connector = (connectorResponse.body as { data: { id: string; projectId: string; provider: string; status: string } }).data;
  assert.equal(connector.projectId, project.id);
  assert.equal(connector.provider, "gsc");
  assert.equal(connector.status, "pending");

  const jobResponse = await app("POST", "/jobs", {
    projectId: project.id,
    type: "connector_sync",
    subject: connector.id,
    payload: { integrationId: connector.id, provider: connector.provider }
  });
  assert.equal(jobResponse.status, 201);
  const job = (jobResponse.body as { data: { id: string; projectId: string; type: string; subject: string; status: string; payload: Record<string, unknown> } }).data;
  assert.equal(job.projectId, project.id);
  assert.equal(job.type, "connector_sync");
  assert.equal(job.subject, connector.id);
  assert.equal(job.status, "queued");
  assert.equal(job.payload.integrationId, connector.id);

  const projectsRead = await app("GET", "/projects");
  assert.equal(projectsRead.status, 200);
  const projects = (projectsRead.body as { data: Array<{ id: string; slug: string }> }).data;
  assert.ok(projects.some((item) => item.id === project.id && item.slug === "welle-1-smoke"));

  const sitesRead = await app("GET", `/projects/${project.id}/sites`);
  assert.equal(sitesRead.status, 200);
  const sites = (sitesRead.body as { data: Array<{ id: string; baseUrl: string }> }).data;
  assert.ok(sites.some((item) => item.id === site.id && item.baseUrl === "https://welle-1.example/"));

  const integrationsRead = await app("GET", "/integrations");
  assert.equal(integrationsRead.status, 200);
  const integrations = (integrationsRead.body as { data: Array<{ id: string; projectId: string; provider: string }> }).data;
  assert.ok(integrations.some((item) => item.id === connector.id && item.projectId === project.id && item.provider === "gsc"));

  const jobsRead = await app("GET", "/jobs");
  assert.equal(jobsRead.status, 200);
  const jobs = (jobsRead.body as { data: Array<{ id: string; projectId: string; type: string; subject: string; status: string }> }).data;
  assert.ok(jobs.some((item) => item.id === job.id && item.projectId === project.id && item.type === "connector_sync" && item.subject === connector.id && item.status === "queued"));

  store.close();
});

test("POST /crawl-runs/schedule creates a crawl run and typed crawl_seed job together", async () => {
  const { app, store } = testApp();
  const response = await app("POST", "/projects/proj-demo/sites/site-demo/crawl-runs/schedule", {
    trigger: "manual",
    baseUrl: "https://example.com",
    sitemapUrl: "https://example.com/sitemap.xml"
  });
  assert.equal(response.status, 201);
  const body = response.body as { data: { crawlRun: { id: string; status: string }; job: { type: string; subject: string; payload: Record<string, unknown> } } };
  assert.equal(body.data.crawlRun.status, "running");
  assert.equal(body.data.job.type, "crawl_seed");
  assert.equal(body.data.job.subject, `https://example.com/:run:${body.data.crawlRun.id}`);
  assert.deepEqual(body.data.job.payload, {
    siteId: "site-demo",
    baseUrl: "https://example.com/",
    crawlRunId: body.data.crawlRun.id,
    sitemapUrl: "https://example.com/sitemap.xml",
    subject: `https://example.com/:run:${body.data.crawlRun.id}`
  });
  store.close();
});

test("POST /integrations assigns provider source confidence", async () => {
  const { app, store } = testApp();
  const response = await app("POST", "/integrations", { projectId: "proj-demo", provider: "matomo" });
  assert.equal(response.status, 201);
  assert.equal((response.body as { data: { sourceConfidence: string } }).data.sourceConfidence, "A");
  store.close();
});

test("backend auth registers, logs in and resolves bearer session", async () => {
  const { app, store } = testApp();
  const register = await app("POST", "/auth/register", {
    email: "Owner@Example.com",
    password: "very-long-password",
    name: "Owner"
  });
  assert.equal(register.status, 201);
  assert.equal((register.body as { data: { email: string } }).data.email, "owner@example.com");

  const login = await app("POST", "/auth/login", {
    email: "owner@example.com",
    password: "very-long-password"
  });
  assert.equal(login.status, 200);
  const token = (login.body as { data: { token: string } }).data.token;
  assert.ok(token.startsWith("seo_"));

  const session = await app("GET", "/auth/session", undefined, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(session.status, 200);
  assert.equal((session.body as { data: { user: { email: string } } }).data.user.email, "owner@example.com");

  const logout = await app("POST", "/auth/logout", undefined, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(logout.status, 204);
  const afterLogout = await app("GET", "/auth/session", undefined, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(afterLogout.status, 401);
  store.close();
});

test("API errors use stable code/message/requestId format", async () => {
  const { app, store } = testApp();
  const validation = await app("POST", "/projects", { name: "Invalid Slug", slug: "Invalid Slug" }, { headers: { "x-request-id": "req-test" } });
  assert.equal(validation.status, 400);
  assert.deepEqual((validation.body as { error: { code: string; requestId: string } }).error, {
    code: "invalid_slug",
    message: "slug must contain lowercase letters, numbers and dashes only",
    requestId: "req-test",
    details: { field: "slug" }
  });

  const auth = await app("POST", "/auth/login", { email: "missing@example.com", password: "very-long-password" }, { headers: { "x-request-id": "req-auth" } });
  assert.equal(auth.status, 401);
  assert.equal((auth.body as { error: { code: string; requestId: string } }).error.code, "invalid_credentials");
  assert.equal((auth.body as { error: { code: string; requestId: string } }).error.requestId, "req-auth");

  const notFound = await app("GET", "/missing", undefined, { headers: { "x-request-id": "req-404" } });
  assert.equal(notFound.status, 404);
  assert.equal((notFound.body as { error: { code: string; requestId: string } }).error.code, "not_found");
  assert.equal((notFound.body as { error: { code: string; requestId: string } }).error.requestId, "req-404");

  const invalidDomainInput = await app("POST", "/auth/register", { email: "not-an-email", password: "very-long-password" }, { headers: { "x-request-id": "req-domain" } });
  assert.equal(invalidDomainInput.status, 400);
  assert.deepEqual((invalidDomainInput.body as { error: { code: string; message: string; requestId: string } }).error, {
    code: "validation_error",
    message: "email must be valid",
    requestId: "req-domain"
  });
  store.close();
});

test("API maps unexpected store errors to internal error responses", async () => {
  const { app, store } = testApp();
  store.listProjects = () => {
    throw new Error("unexpected store failure");
  };

  const response = await app("GET", "/projects", undefined, { headers: { "x-request-id": "req-store" } });
  assert.equal(response.status, 500);
  assert.deepEqual((response.body as { error: { code: string; message: string; requestId: string } }).error, {
    code: "internal_error",
    message: "Internal error",
    requestId: "req-store"
  });
  store.close();
});

test("API maps duplicate and invalid input errors to stable codes", async () => {
  const { app, store } = testApp();
  await app("POST", "/auth/register", { email: "dup@example.com", password: "very-long-password" });
  const duplicateEmail = await app("POST", "/auth/register", { email: "dup@example.com", password: "very-long-password" });
  assert.equal(duplicateEmail.status, 409);
  assert.equal((duplicateEmail.body as { error: { code: string } }).error.code, "duplicate_email");

  const invalidProvider = await app("POST", "/integrations", { projectId: "proj-demo", provider: "unknown" });
  assert.equal(invalidProvider.status, 400);
  assert.equal((invalidProvider.body as { error: { code: string } }).error.code, "invalid_enum");
  store.close();
});

test("crawl discovery API persists sitemap URLs with source metadata", async () => {
  const { app, store } = testApp();
  const discoveredAt = "2026-06-02T08:00:00.000Z";
  const urls = [
    {
      id: "url-seed-demo",
      projectId: "proj-demo",
      siteId: "site-demo",
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
      source: "seed",
      discoveredFrom: null,
      depth: 0,
      discoveredAt
    },
    {
      id: "url-pricing-demo",
      projectId: "proj-demo",
      siteId: "site-demo",
      url: "https://example.com/pricing/",
      normalizedUrl: "https://example.com/pricing",
      source: "sitemap",
      discoveredFrom: "https://example.com/sitemap.xml",
      depth: 1,
      discoveredAt
    }
  ];

  const first = await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", { urls });
  assert.equal(first.status, 201);
  assert.deepEqual((first.body as { meta: { inserted: number; updated: number } }).meta, { inserted: 2, updated: 0 });

  const second = await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", { urls: [{ ...urls[1], source: "link", depth: 2 }] });
  assert.equal(second.status, 201);
  assert.deepEqual((second.body as { meta: { inserted: number; updated: number } }).meta, { inserted: 0, updated: 1 });

  const list = await app("GET", "/projects/proj-demo/sites/site-demo/discovered-urls");
  assert.equal(list.status, 200);
  const data = (list.body as { data: Array<{ normalizedUrl: string; source: string; depth: number }> }).data;
  assert.equal(data.length, 2);
  assert.deepEqual(data.map((item) => item.normalizedUrl), ["https://example.com/", "https://example.com/pricing"]);
  assert.equal(data[1]?.source, "link");
  assert.equal(data[1]?.depth, 2);
  store.close();
});


test("limited crawl list endpoints expose pagination, filters, and URL explorer latest details", async () => {
  const { app, store } = testApp();
  const discoveredAt = "2026-06-02T08:00:00.000Z";
  await app("POST", "/projects/proj-demo/sites/site-demo/crawl-runs", { trigger: "manual" });
  const secondRun = await app("POST", "/projects/proj-demo/sites/site-demo/crawl-runs", { trigger: "deploy" });
  const secondRunId = (secondRun.body as { data: { id: string } }).data.id;
  await app("POST", `/projects/proj-demo/sites/site-demo/crawl-runs/${secondRunId}/complete`, { status: "succeeded" });

  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
    urls: [
      { id: "url-page-one", projectId: "proj-demo", siteId: "site-demo", url: "https://example.com/a", normalizedUrl: "https://example.com/a", source: "sitemap", discoveredFrom: null, depth: 1, discoveredAt },
      { id: "url-page-two", projectId: "proj-demo", siteId: "site-demo", url: "https://example.com/b", normalizedUrl: "https://example.com/b", source: "link", discoveredFrom: "https://example.com/a", depth: 2, discoveredAt: "2026-06-02T08:01:00.000Z" }
    ]
  });
  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls/url-page-one/fetch-results", {
    url: "https://example.com/a",
    finalUrl: "https://example.com/a",
    statusCode: 500,
    statusClass: "server_error",
    headers: {},
    redirectChain: [],
    fetchedAt: "2026-06-02T08:02:00.000Z"
  });
  const latestFetch = await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls/url-page-one/fetch-results", {
    url: "https://example.com/a",
    finalUrl: "https://example.com/a",
    statusCode: 200,
    statusClass: "success",
    headers: {},
    redirectChain: [],
    fetchedAt: "2026-06-02T08:03:00.000Z"
  });
  const latestFetchId = (latestFetch.body as { data: { id: string } }).data.id;
  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls/url-page-one/indexability", {
    url: "https://example.com/a",
    state: "indexable",
    isIndexable: true,
    reasons: [],
    canonicalUrl: null,
    fetchResultId: latestFetchId,
    assessedAt: "2026-06-02T08:04:00.000Z"
  });
  await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    checkedDiscoveredUrlIds: ["url-page-one"],
    issues: [
      { id: "issue-page-one", projectId: "proj-demo", siteId: "site-demo", discoveredUrlId: "url-page-one", url: "https://example.com/a", rule: "http_error", severity: "critical", message: "Server error", detectedAt: "2026-06-02T08:05:00.000Z", resolvedAt: null }
    ]
  });

  const runs = await app("GET", "/projects/proj-demo/sites/site-demo/crawl-runs?limit=1&status=succeeded");
  assert.equal(runs.status, 200);
  assert.equal((runs.body as { data: Array<{ status: string }>; meta: { total: number; limit: number } }).data[0]?.status, "succeeded");
  assert.deepEqual((runs.body as { meta: { total: number; limit: number } }).meta, { limit: 1, offset: 0, total: 1, nextCursor: null });

  const urls = await app("GET", "/projects/proj-demo/sites/site-demo/discovered-urls?limit=1&offset=0&source=link");
  assert.equal(urls.status, 200);
  assert.equal((urls.body as { data: Array<{ id: string }> }).data[0]?.id, "url-page-two");
  assert.equal((urls.body as { meta: { total: number } }).meta.total, 1);

  const issues = await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues?limit=5&status=open&severity=critical&rule=http_error");
  assert.equal(issues.status, 200);
  assert.equal((issues.body as { data: Array<{ id: string }> }).data[0]?.id, "issue-page-one");

  const explorer = await app("GET", "/projects/proj-demo/sites/site-demo/url-explorer?limit=1");
  assert.equal(explorer.status, 200);
  const explorerData = (explorer.body as { data: Array<{ discoveredUrl: { id: string }; latestFetch: { statusCode: number }; latestIndexability: { state: string } }>; meta: { total: number; nextCursor: string | null } });
  assert.equal(explorerData.data[0]?.discoveredUrl.id, "url-page-one");
  assert.equal(explorerData.data[0]?.latestFetch.statusCode, 200);
  assert.equal(explorerData.data[0]?.latestIndexability.state, "indexable");
  assert.equal(explorerData.meta.total, 2);
  assert.ok(explorerData.meta.nextCursor);
  store.close();
});

test("crawl fetch API stores normalized fetch results for a discovered URL", async () => {
  const { app, store } = testApp();
  const discoveredAt = "2026-06-02T08:00:00.000Z";
  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
    urls: [
      {
        id: "url-fetch-demo",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/redirect",
        normalizedUrl: "https://example.com/redirect",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt
      }
    ]
  });

  const response = await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls/url-fetch-demo/fetch-results", {
    url: "https://example.com/redirect",
    finalUrl: "https://example.com/final",
    statusCode: 301,
    statusClass: "redirect",
    headers: { Location: "https://example.com/final" },
    redirectChain: ["https://example.com/redirect", "https://example.com/final"],
    fetchedAt: "2026-06-02T08:01:00.000Z"
  });

  assert.equal(response.status, 201);
  const created = (response.body as { data: { statusClass: string; statusCode: number; headers: Record<string, string> } }).data;
  assert.equal(created.statusClass, "redirect");
  assert.equal(created.statusCode, 301);
  assert.equal(created.headers.location, "https://example.com/final");

  const list = await app("GET", "/projects/proj-demo/sites/site-demo/discovered-urls/url-fetch-demo/fetch-results");
  assert.equal(list.status, 200);
  const data = (list.body as { data: Array<{ finalUrl: string; redirectChain: string[] }> }).data;
  assert.equal(data.length, 1);
  assert.equal(data[0]?.finalUrl, "https://example.com/final");
  assert.deepEqual(data[0]?.redirectChain, ["https://example.com/redirect", "https://example.com/final"]);
  store.close();
});

test("crawl indexability API stores deterministic assessment state", async () => {
  const { app, store } = testApp();
  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
    urls: [
      {
        id: "url-index-demo",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/noindex",
        normalizedUrl: "https://example.com/noindex",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt: "2026-06-02T08:00:00.000Z"
      }
    ]
  });
  const fetch = await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls/url-index-demo/fetch-results", {
    url: "https://example.com/noindex",
    finalUrl: "https://example.com/noindex",
    statusCode: 200,
    statusClass: "success",
    headers: { "x-robots-tag": "noindex" },
    redirectChain: [],
    fetchedAt: "2026-06-02T08:01:00.000Z"
  });
  const fetchResultId = (fetch.body as { data: { id: string } }).data.id;

  const response = await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls/url-index-demo/indexability", {
    url: "https://example.com/noindex",
    state: "blocked_by_x_robots",
    isIndexable: false,
    reasons: ["X-Robots-Tag contains noindex"],
    canonicalUrl: null,
    fetchResultId,
    assessedAt: "2026-06-02T08:02:00.000Z"
  });

  assert.equal(response.status, 201);
  const created = (response.body as { data: { state: string; isIndexable: boolean; fetchResultId: string } }).data;
  assert.equal(created.state, "blocked_by_x_robots");
  assert.equal(created.isIndexable, false);
  assert.equal(created.fetchResultId, fetchResultId);

  const list = await app("GET", "/projects/proj-demo/sites/site-demo/discovered-urls/url-index-demo/indexability");
  assert.equal(list.status, 200);
  const data = (list.body as { data: Array<{ reasons: string[]; canonicalUrl: string | null }> }).data;
  assert.deepEqual(data[0]?.reasons, ["X-Robots-Tag contains noindex"]);
  assert.equal(data[0]?.canonicalUrl, null);
  store.close();
});

test("crawl run API records issues, computes health, and completes run summaries", async () => {
  const { app, store } = testApp();
  const run = await app("POST", "/projects/proj-demo/sites/site-demo/crawl-runs", { trigger: "manual" });
  assert.equal(run.status, 201);
  const runId = (run.body as { data: { id: string } }).data.id;

  const issues = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    issues: [
      {
        id: "issue-health-critical",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: null,
        url: "https://example.com/broken",
        rule: "http_error",
        severity: "critical",
        message: "URL returns 500",
        detectedAt: "2026-06-02T08:10:00.000Z",
        resolvedAt: null
      },
      {
        id: "issue-health-low",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: null,
        url: "https://example.com/title",
        rule: "missing_title",
        severity: "low",
        message: "Title is missing",
        detectedAt: "2026-06-02T08:11:00.000Z",
        resolvedAt: null
      }
    ]
  });
  assert.equal(issues.status, 201);
  assert.deepEqual((issues.body as { meta: { inserted: number; updated: number; resolved: number } }).meta, { inserted: 2, updated: 0, resolved: 0 });

  const health = await app("POST", "/projects/proj-demo/sites/site-demo/health-scores/compute");
  assert.equal(health.status, 201);
  assert.equal((health.body as { data: { score: number; totalIssues: number } }).data.score, 80);
  assert.equal((health.body as { data: { score: number; totalIssues: number } }).data.totalIssues, 2);

  const complete = await app("POST", `/projects/proj-demo/sites/site-demo/crawl-runs/${runId}/complete`, { status: "succeeded" });
  assert.equal(complete.status, 200);
  assert.deepEqual((complete.body as { data: { summary: { openIssues: number; healthScore: number } } }).data.summary, {
    discoveredUrls: 0,
    fetchedUrls: 0,
    indexabilityAssessments: 0,
    openIssues: 2,
    healthScore: 80
  });
  store.close();
});


test("audit issue recording resolves stale open issues on recrawl", async () => {
  const { app, store } = testApp();
  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
    urls: [
      {
        id: "url-recrawl-down",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/down",
        normalizedUrl: "https://example.com/down",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt: "2026-06-04T07:59:00.000Z"
      },
      {
        id: "url-recrawl-title",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/title",
        normalizedUrl: "https://example.com/title",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt: "2026-06-04T07:59:00.000Z"
      }
    ]
  });
  await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    checkedDiscoveredUrlIds: ["url-recrawl-down", "url-recrawl-title"],
    issues: [
      {
        id: "issue-recrawl-critical",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: "url-recrawl-down",
        url: "https://example.com/down",
        rule: "http_error",
        severity: "critical",
        message: "URL returns 500",
        detectedAt: "2026-06-04T08:00:00.000Z",
        resolvedAt: null
      },
      {
        id: "issue-recrawl-low",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: "url-recrawl-title",
        url: "https://example.com/title",
        rule: "missing_title",
        severity: "low",
        message: "Title is missing",
        detectedAt: "2026-06-04T08:01:00.000Z",
        resolvedAt: null
      }
    ]
  });

  const recrawl = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    checkedDiscoveredUrlIds: ["url-recrawl-down", "url-recrawl-title"],
    issues: [
      {
        id: "issue-recrawl-low",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: "url-recrawl-title",
        url: "https://example.com/title",
        rule: "missing_title",
        severity: "low",
        message: "Title is missing",
        detectedAt: "2026-06-04T08:02:00.000Z",
        resolvedAt: null
      }
    ]
  });
  assert.equal(recrawl.status, 201);
  assert.deepEqual((recrawl.body as { meta: { inserted: number; updated: number; resolved: number } }).meta, { inserted: 0, updated: 1, resolved: 1 });

  const health = await app("POST", "/projects/proj-demo/sites/site-demo/health-scores/compute", {});
  assert.equal(health.status, 201);
  assert.equal((health.body as { data: { totalIssues: number; score: number } }).data.totalIssues, 1);
  assert.equal((health.body as { data: { totalIssues: number; score: number } }).data.score, 98);
  store.close();
});


test("audit issue recording keeps issues for unchecked discovered URLs open", async () => {
  const { app, store } = testApp();
  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
    urls: [
      {
        id: "url-scope-checked",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/checked",
        normalizedUrl: "https://example.com/checked",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt: "2026-06-04T08:00:00.000Z"
      },
      {
        id: "url-scope-unchecked",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/unchecked",
        normalizedUrl: "https://example.com/unchecked",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt: "2026-06-04T08:00:00.000Z"
      }
    ]
  });
  await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    checkedDiscoveredUrlIds: ["url-scope-checked", "url-scope-unchecked"],
    issues: [
      {
        id: "issue-scope-checked",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: "url-scope-checked",
        url: "https://example.com/checked",
        rule: "missing_title",
        severity: "low",
        message: "Title is missing",
        detectedAt: "2026-06-04T08:01:00.000Z",
        resolvedAt: null
      },
      {
        id: "issue-scope-unchecked",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: "url-scope-unchecked",
        url: "https://example.com/unchecked",
        rule: "http_error",
        severity: "critical",
        message: "URL returns 500",
        detectedAt: "2026-06-04T08:02:00.000Z",
        resolvedAt: null
      }
    ]
  });

  const recrawl = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    checkedDiscoveredUrlIds: ["url-scope-checked"],
    issues: []
  });
  assert.equal(recrawl.status, 201);
  assert.deepEqual((recrawl.body as { meta: { inserted: number; updated: number; resolved: number } }).meta, { inserted: 0, updated: 0, resolved: 1 });

  const issues = (await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues")).body as { data: Array<{ id: string; resolvedAt: string | null }> };
  const checked = issues.data.find((issue) => issue.id === "issue-scope-checked");
  const unchecked = issues.data.find((issue) => issue.id === "issue-scope-unchecked");
  assert.equal(checked?.resolvedAt !== null, true);
  assert.equal(unchecked?.resolvedAt, null);
  store.close();
});


test("audit issue API resolves issues and health recompute ignores resolved issues", async () => {
  const { app, store } = testApp();
  await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    issues: [
      {
        id: "issue-resolve-critical",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: null,
        url: "https://example.com/down",
        rule: "http_error",
        severity: "critical",
        message: "URL returns 500",
        detectedAt: "2026-06-04T08:00:00.000Z",
        resolvedAt: null
      },
      {
        id: "issue-resolve-low",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: null,
        url: "https://example.com/title",
        rule: "missing_title",
        severity: "low",
        message: "Title is missing",
        detectedAt: "2026-06-04T08:01:00.000Z",
        resolvedAt: null
      }
    ]
  });

  const resolved = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues/issue-resolve-critical/resolve", {});
  assert.equal(resolved.status, 200);
  assert.equal((resolved.body as { data: { resolvedAt: string | null } }).data.resolvedAt !== null, true);

  const health = await app("POST", "/projects/proj-demo/sites/site-demo/health-scores/compute", {});
  assert.equal(health.status, 201);
  assert.equal((health.body as { data: { totalIssues: number; score: number } }).data.totalIssues, 1);
  assert.equal((health.body as { data: { totalIssues: number; score: number } }).data.score, 98);

  const reopened = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues/issue-resolve-critical/reopen", {});
  assert.equal(reopened.status, 200);
  assert.equal((reopened.body as { data: { resolvedAt: string | null } }).data.resolvedAt, null);

  const dismissed = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues/issue-resolve-low/dismiss", {});
  assert.equal(dismissed.status, 200);
  assert.equal((dismissed.body as { data: { resolvedAt: string | null } }).data.resolvedAt !== null, true);

  const healthAfterIssueActions = await app("POST", "/projects/proj-demo/sites/site-demo/health-scores/compute", {});
  assert.equal((healthAfterIssueActions.body as { data: { totalIssues: number; score: number } }).data.totalIssues, 1);
  assert.equal((healthAfterIssueActions.body as { data: { totalIssues: number; score: number } }).data.score, 82);

  const missing = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues/missing/resolve", {});
  assert.equal(missing.status, 404);
  assert.equal((missing.body as { error: { code: string } }).error.code, "audit_issue_not_found");
  store.close();
});
