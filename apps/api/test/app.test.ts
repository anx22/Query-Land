import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createSQLiteStore } from "../src/sqlite-store.js";

function testApp() {
  const store = createSQLiteStore("sqlite::memory:");
  return { app: createApp(store), store };
}

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

test("crawl audit issue API stores rule severities and updates duplicates", async () => {
  const { app, store } = testApp();
  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
    urls: [
      {
        id: "url-issue-demo",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/broken",
        normalizedUrl: "https://example.com/broken",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt: "2026-06-02T08:00:00.000Z"
      }
    ]
  });

  const issues = [
    {
      id: "issue-http-demo",
      projectId: "proj-demo",
      siteId: "site-demo",
      discoveredUrlId: "url-issue-demo",
      url: "https://example.com/broken",
      rule: "http_error",
      severity: "high",
      message: "HTTP fetch returned 404.",
      detectedAt: "2026-06-02T08:03:00.000Z",
      resolvedAt: null
    }
  ];

  const first = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", { issues });
  assert.equal(first.status, 201);
  assert.deepEqual((first.body as { meta: { inserted: number; updated: number } }).meta, { inserted: 1, updated: 0 });

  const second = await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", { issues: [{ ...issues[0], severity: "critical" }] });
  assert.equal(second.status, 201);
  assert.deepEqual((second.body as { meta: { inserted: number; updated: number } }).meta, { inserted: 0, updated: 1 });

  const list = await app("GET", "/projects/proj-demo/sites/site-demo/audit-issues");
  assert.equal(list.status, 200);
  const data = (list.body as { data: Array<{ rule: string; severity: string; discoveredUrlId: string | null }> }).data;
  assert.equal(data.length, 1);
  assert.equal(data[0]?.rule, "http_error");
  assert.equal(data[0]?.severity, "critical");
  assert.equal(data[0]?.discoveredUrlId, "url-issue-demo");
  store.close();
});

test("crawl health score API computes from unresolved audit issue severities", async () => {
  const { app, store } = testApp();
  const issues = [
    {
      id: "issue-health-critical",
      projectId: "proj-demo",
      siteId: "site-demo",
      discoveredUrlId: null,
      url: "https://example.com/critical",
      rule: "http_error",
      severity: "critical",
      message: "HTTP fetch returned 500.",
      detectedAt: "2026-06-02T08:03:00.000Z",
      resolvedAt: null
    },
    {
      id: "issue-health-resolved",
      projectId: "proj-demo",
      siteId: "site-demo",
      discoveredUrlId: null,
      url: "https://example.com/resolved",
      rule: "missing_title",
      severity: "medium",
      message: "Page is missing a title element.",
      detectedAt: "2026-06-02T08:03:00.000Z",
      resolvedAt: "2026-06-02T08:04:00.000Z"
    }
  ];
  await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", { issues });

  const computed = await app("POST", "/projects/proj-demo/sites/site-demo/health-scores/compute");
  assert.equal(computed.status, 201);
  const score = (computed.body as { data: { score: number; totalIssues: number; issueCounts: Record<string, number> } }).data;
  assert.equal(score.score, 82);
  assert.equal(score.totalIssues, 1);
  assert.deepEqual(score.issueCounts, { critical: 1, high: 0, medium: 0, low: 0 });

  const list = await app("GET", "/projects/proj-demo/sites/site-demo/health-scores");
  assert.equal(list.status, 200);
  const data = (list.body as { data: Array<{ score: number }> }).data;
  assert.equal(data[0]?.score, 82);
  store.close();
});

test("crawl run API creates and completes a run with summary counters", async () => {
  const { app, store } = testApp();
  const created = await app("POST", "/projects/proj-demo/sites/site-demo/crawl-runs", { trigger: "manual" });
  assert.equal(created.status, 201);
  const run = (created.body as { data: { id: string; status: string; summary: { discoveredUrls: number } } }).data;
  assert.equal(run.status, "running");
  assert.equal(run.summary.discoveredUrls, 0);

  await app("POST", "/projects/proj-demo/sites/site-demo/discovered-urls", {
    urls: [
      {
        id: "url-run-demo",
        projectId: "proj-demo",
        siteId: "site-demo",
        url: "https://example.com/run",
        normalizedUrl: "https://example.com/run",
        source: "sitemap",
        discoveredFrom: "https://example.com/sitemap.xml",
        depth: 1,
        discoveredAt: "2026-06-02T08:00:00.000Z"
      }
    ]
  });
  await app("POST", "/projects/proj-demo/sites/site-demo/audit-issues", {
    issues: [
      {
        id: "issue-run-demo",
        projectId: "proj-demo",
        siteId: "site-demo",
        discoveredUrlId: "url-run-demo",
        url: "https://example.com/run",
        rule: "missing_title",
        severity: "medium",
        message: "Page is missing a title element.",
        detectedAt: "2026-06-02T08:03:00.000Z",
        resolvedAt: null
      }
    ]
  });
  await app("POST", "/projects/proj-demo/sites/site-demo/health-scores/compute");

  const completed = await app("POST", `/projects/proj-demo/sites/site-demo/crawl-runs/${run.id}/complete`, { status: "succeeded" });
  assert.equal(completed.status, 200);
  const completedRun = (completed.body as { data: { status: string; finishedAt: string | null; summary: { discoveredUrls: number; openIssues: number; healthScore: number | null } } }).data;
  assert.equal(completedRun.status, "succeeded");
  assert.ok(completedRun.finishedAt);
  assert.equal(completedRun.summary.discoveredUrls, 1);
  assert.equal(completedRun.summary.openIssues, 1);
  assert.equal(completedRun.summary.healthScore, 95);

  const list = await app("GET", "/projects/proj-demo/sites/site-demo/crawl-runs");
  assert.equal(list.status, 200);
  const data = (list.body as { data: Array<{ id: string }> }).data;
  assert.equal(data[0]?.id, run.id);
  store.close();
});
