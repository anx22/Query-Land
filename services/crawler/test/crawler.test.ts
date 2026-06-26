import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CRAWLER_USER_AGENT, assessIndexability, backoffDelayMs, calculateHealthScore, discoverUrlsFromSitemap, discoverUrlsFromSitemapIndex, evaluateAuditIssues, extractOutgoingLinks, fetchUrl, isInCrawlScope, isRobotsAllowed, parseRobotsTxt } from "../src/index.js";

test("discovers seed and sitemap URLs with source metadata", () => {
  const urls = discoverUrlsFromSitemap({
    projectId: "proj-demo",
    siteId: "site-demo",
    baseUrl: "https://example.com/",
    sitemapUrl: "https://example.com/sitemap.xml",
    discoveredAt: "2026-06-02T08:00:00Z",
    sitemapXml: "<urlset><url><loc>https://example.com/pricing/</loc></url><url><loc>https://example.com/blog?a=1&amp;b=2</loc></url></urlset>"
  });

  assert.equal(urls.length, 3);
  assert.equal(urls[0]?.source, "seed");
  assert.equal(urls[1]?.source, "sitemap");
  assert.equal(urls[1]?.normalizedUrl, "https://example.com/pricing");
  assert.equal(urls[2]?.discoveredFrom, "https://example.com/sitemap.xml");
});

test("discovers page URLs from a bounded in-scope sitemap index", async () => {
  const fetched: string[] = [];
  const urls = await discoverUrlsFromSitemapIndex({
    projectId: "proj-demo",
    siteId: "site-demo",
    baseUrl: "https://example.com/",
    sitemapUrl: "https://example.com/sitemap.xml",
    discoveredAt: "2026-06-02T08:00:00Z",
    sitemapXml: `
      <sitemapindex>
        <sitemap><loc>https://example.com/pages-a.xml</loc></sitemap>
        <sitemap><loc>https://outside.example/pages-b.xml</loc></sitemap>
      </sitemapindex>
    `,
    fetchImpl: async (url: string | URL | Request) => {
      const requestedUrl = String(url);
      fetched.push(requestedUrl);
      return new Response("<urlset><url><loc>https://example.com/pricing/</loc></url><url><loc>https://example.com/blog?a=1&amp;b=2</loc></url></urlset>", { status: 200 });
    }
  });

  assert.deepEqual(fetched, ["https://example.com/pages-a.xml"]);
  assert.deepEqual(urls.map((url) => url.normalizedUrl), ["https://example.com/", "https://example.com/pricing", "https://example.com/blog?a=1&b=2"]);
  assert.equal(urls[1]?.discoveredFrom, "https://example.com/pages-a.xml");
});

test("normalizes 200, 3xx and 4xx fixture fetch responses", async () => {
  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    if (requestedUrl.endsWith("/redirect")) {
      return new Response(null, { status: 301, headers: { location: "/final" } });
    }
    if (requestedUrl.endsWith("/missing")) {
      return new Response("missing", { status: 404, headers: { "x-robots-tag": "noindex" } });
    }
    return new Response("ok", { status: 200, headers: { "content-type": "text/html" } });
  };

  const ok = await fetchUrl({ url: "https://example.com/", fetchImpl, fetchedAt: "2026-06-02T08:00:00Z" });
  const redirect = await fetchUrl({ url: "https://example.com/redirect", fetchImpl, fetchedAt: "2026-06-02T08:00:00Z" });
  const missing = await fetchUrl({ url: "https://example.com/missing", fetchImpl, fetchedAt: "2026-06-02T08:00:00Z" });

  assert.equal(ok.statusClass, "success");
  assert.equal(redirect.statusClass, "redirect");
  assert.deepEqual(redirect.redirectChain, ["https://example.com/redirect", "https://example.com/final"]);
  assert.equal(missing.statusClass, "client_error");
  assert.equal(missing.headers["x-robots-tag"], "noindex");
});



test("extracts and normalizes outgoing links", () => {
  const links = extractOutgoingLinks(
    `<a href="/a#section">A</a><a href='https://example.com/b/'>B</a><a href="mailto:test@example.com">Mail</a><a href="https://outside.example/c">C</a>`,
    "https://example.com/base/page"
  );

  assert.deepEqual(links, ["https://example.com/a", "https://example.com/b", "https://outside.example/c"]);
});


test("fetchUrl retries deterministic network errors before classifying the fetch", async () => {
  let attempts = 0;
  const result = await fetchUrl({
    url: "https://example.com/flaky",
    retry: { maxAttempts: 2 },
    fetchImpl: async () => {
      attempts += 1;
      throw new Error("socket timeout");
    }
  });

  assert.equal(attempts, 2);
  assert.equal(result.statusClass, "network_error");
  assert.match(result.errorMessage ?? "", /after 2 attempts/);
});

test("fetchUrl detects redirect loops before exhausting the crawler", async () => {
  const result = await fetchUrl({
    url: "https://example.com/a",
    maxRedirects: 5,
    fetchImpl: async (url: string | URL | Request) => {
      const requestedUrl = String(url);
      const nextUrl = requestedUrl.endsWith("/a") ? "https://example.com/b" : "https://example.com/a";
      return new Response(null, { status: 302, headers: { location: nextUrl } });
    }
  });

  assert.equal(result.statusClass, "network_error");
  assert.match(result.errorMessage ?? "", /redirect loop detected/);
});

test("parses robots.txt allow and disallow rules by longest path", () => {
  const policy = {
    fetchedUrl: "https://example.com/robots.txt",
    rules: parseRobotsTxt("User-agent: *\nDisallow: /private\nAllow: /private/public\n")
  };

  assert.equal(isRobotsAllowed("https://example.com/private/page", policy), false);
  assert.equal(isRobotsAllowed("https://example.com/private/public/page", policy), true);
  assert.equal(isRobotsAllowed("https://example.com/open", policy), true);
});

test("robots groups accumulate consecutive user-agent lines into shared rules", () => {
  // Two consecutive user-agent lines must SHARE the following rules, not
  // overwrite each other.
  const rules = parseRobotsTxt("User-agent: SeoToolBot\nUser-agent: GoogleBot\nDisallow: /shared\n");
  const seo = rules.filter((rule) => rule.userAgent === "seotoolbot");
  const google = rules.filter((rule) => rule.userAgent === "googlebot");

  assert.equal(seo.length, 1);
  assert.equal(google.length, 1);
  assert.equal(seo[0]?.path, "/shared");
  assert.equal(google[0]?.path, "/shared");

  // A new user-agent line after a rule starts a fresh group.
  const multi = parseRobotsTxt("User-agent: a\nDisallow: /one\nUser-agent: b\nDisallow: /two\n");
  assert.deepEqual(multi.filter((r) => r.userAgent === "a").map((r) => r.path), ["/one"]);
  assert.deepEqual(multi.filter((r) => r.userAgent === "b").map((r) => r.path), ["/two"]);
});

test("robots selects the most specific matching agent group and falls back to *", () => {
  const policy = {
    fetchedUrl: "https://example.com/robots.txt",
    rules: parseRobotsTxt("User-agent: *\nDisallow: /\nUser-agent: SeoToolBot\nAllow: /\nDisallow: /admin\n")
  };

  // Specific SeoToolBot group wins over the wildcard for our UA.
  assert.equal(isRobotsAllowed("https://example.com/page", policy, "SeoToolBot/1.0"), true);
  assert.equal(isRobotsAllowed("https://example.com/admin/x", policy, "SeoToolBot/1.0"), false);
  // An unrelated UA falls back to the wildcard group (disallow all).
  assert.equal(isRobotsAllowed("https://example.com/page", policy, "OtherBot/9"), false);
  // The default crawler UA matches the SeoToolBot group via prefix.
  assert.equal(DEFAULT_CRAWLER_USER_AGENT.toLowerCase().startsWith("seotoolbot"), true);
  assert.equal(isRobotsAllowed("https://example.com/page", policy), true);
});

test("backoffDelayMs produces a capped exponential sequence", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((attempt) => backoffDelayMs(attempt, 100, 5000)), [100, 200, 400, 800, 1600]);
  // Cap applies.
  assert.equal(backoffDelayMs(10, 100, 5000), 5000);
  // Zero base disables sleeping entirely.
  assert.equal(backoffDelayMs(3, 0, 5000), 0);
});

test("fetchUrl applies capped exponential backoff between retries with an injected clock", async () => {
  const delays: number[] = [];
  let attempts = 0;
  const result = await fetchUrl({
    url: "https://example.com/flaky",
    retry: {
      maxAttempts: 4,
      delayMs: 100,
      maxDelayMs: 5000,
      sleep: async (ms: number) => {
        delays.push(ms);
      }
    },
    fetchImpl: async () => {
      attempts += 1;
      throw new Error("socket timeout");
    }
  });

  assert.equal(attempts, 4);
  // 3 waits between 4 attempts, exponential and deterministic — no real timers.
  assert.deepEqual(delays, [100, 200, 400]);
  assert.equal(result.statusClass, "network_error");
  assert.match(result.errorMessage ?? "", /after 4 attempts/);
});

test("fetchUrl sends the configured User-Agent header (and a default otherwise)", async () => {
  let sentDefault: string | null = null;
  await fetchUrl({
    url: "https://example.com/",
    fetchImpl: async (_url, init) => {
      sentDefault = new Headers(init?.headers).get("user-agent");
      return new Response("ok", { status: 200 });
    }
  });
  assert.equal(sentDefault, DEFAULT_CRAWLER_USER_AGENT);

  let sentCustom: string | null = null;
  await fetchUrl({
    url: "https://example.com/",
    userAgent: "CustomBot/2.0",
    fetchImpl: async (_url, init) => {
      sentCustom = new Headers(init?.headers).get("user-agent");
      return new Response("ok", { status: 200 });
    }
  });
  assert.equal(sentCustom, "CustomBot/2.0");
});

test("fetchUrl on garbage/invalid sitemap content still classifies without throwing", async () => {
  const result = await fetchUrl({
    url: "https://example.com/sitemap.xml",
    fetchImpl: async () => new Response("<<<not xml>>>", { status: 200 })
  });
  assert.equal(result.statusClass, "success");
  assert.equal(result.responseBody, "<<<not xml>>>");
});


test("crawl scope keeps only same-protocol same-host URLs", () => {
  assert.equal(isInCrawlScope("https://example.com/a", "https://example.com"), true);
  assert.equal(isInCrawlScope("http://example.com/a", "https://example.com"), false);
  assert.equal(isInCrawlScope("https://other.example/a", "https://example.com"), false);
});


test("assigns deterministic indexability states", () => {
  assert.equal(assessIndexability({ url: "https://example.com/noindex", statusCode: 200, html: '<meta name="robots" content="noindex">' }).state, "blocked_by_meta");
  assert.equal(assessIndexability({ url: "https://example.com/x", statusCode: 200, headers: { "X-Robots-Tag": "noindex" } }).state, "blocked_by_x_robots");
  assert.equal(assessIndexability({ url: "https://example.com/404", statusCode: 404 }).state, "blocked_by_status");
  assert.equal(assessIndexability({ url: "https://example.com/a", finalUrl: "https://example.com/a", statusCode: 200, html: '<link rel="canonical" href="https://example.com/b">' }).state, "canonicalized");
  assert.equal(assessIndexability({ url: "https://example.com/a", statusCode: 200, html: '<title>A</title>' }).state, "indexable");
});

test("maps minimum issue rules and health-score penalties", () => {
  const issues = evaluateAuditIssues([
    { url: "https://example.com/a", statusCode: 200, html: "<title>Same</title>", outgoingLinks: [{ url: "https://example.com/missing", statusCode: 404 }] },
    { url: "https://example.com/b", statusCode: 200, html: "<title>Same</title>" },
    { url: "https://example.com/c", statusCode: 500, html: "" },
    { url: "https://example.com/d", statusCode: 302, html: '<link rel="canonical" href="https://example.com/canonical">' }
  ]);

  assert(issues.some((issue) => issue.rule === "broken_link" && issue.severity === "high"));
  assert(issues.some((issue) => issue.rule === "duplicate_title" && issue.severity === "low"));
  assert(issues.some((issue) => issue.rule === "http_error" && issue.severity === "critical"));
  assert(issues.some((issue) => issue.rule === "redirect_chain" && issue.severity === "medium"));
  assert(issues.some((issue) => issue.rule === "canonical_mismatch" && issue.severity === "medium"));
  assert(calculateHealthScore(issues) < 100);
  assert.equal(calculateHealthScore([]), 100);
});

import { createApp, createStore, type Store } from "@seo-tool/api";
import type { CrawlWorkerApiClient } from "../src/index.js";
import { runCrawlWorkerCycle } from "../src/index.js";

// Self-provisions a real project + site (the demo seed no longer exists) and returns the app
// plus the generated ids to thread through job payloads, GET assertions and route paths.
async function setupSite(store: Store): Promise<{ app: ReturnType<typeof createApp>; projectId: string; siteId: string }> {
  const app = createApp(store);
  const project = envelopeData<{ id: string }>(await app("POST", "/projects", { name: "Crawler Test", slug: `crawler-${Math.random().toString(36).slice(2)}` }));
  const site = envelopeData<{ id: string }>(await app("POST", `/projects/${project.id}/sites`, { baseUrl: "https://example.com", scopeType: "domain" }));
  return { app, projectId: project.id, siteId: site.id };
}

function apiClientForStore(store: Store): CrawlWorkerApiClient {
  const app = createApp(store);
  const post = async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await app("POST", path, body);
    assert.equal(response.status >= 200 && response.status < 300, true, JSON.stringify(response.body));
    return envelopeData<T>(response);
  };
  return {
    claimNextJob: () => post("/jobs/claim", { type: "crawl_seed" }),
    createCrawlRun: (projectId, siteId, trigger) => post(`/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger }),
    recordDiscoveredUrls: async (projectId, siteId, urls) => post(`/projects/${projectId}/sites/${siteId}/discovered-urls`, { urls }),
    recordFetchResult: (projectId, siteId, discoveredUrlId, result) => post(`/projects/${projectId}/sites/${siteId}/discovered-urls/${discoveredUrlId}/fetch-results`, result),
    recordIndexabilityAssessment: (projectId, siteId, discoveredUrlId, assessment) => post(`/projects/${projectId}/sites/${siteId}/discovered-urls/${discoveredUrlId}/indexability`, assessment),
    recordAuditIssues: (projectId, siteId, issues, checkedDiscoveredUrlIds) => post(`/projects/${projectId}/sites/${siteId}/audit-issues`, { issues, checkedDiscoveredUrlIds }),
    computeHealthScore: (projectId, siteId) => post(`/projects/${projectId}/sites/${siteId}/health-scores/compute`, {}),
    completeCrawlRun: (projectId, siteId, crawlRunId, status, errorMessage) => post(`/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/complete`, { status, errorMessage }),
    completeJob: (jobId, status, lastError) => post(`/jobs/${jobId}/complete`, { status, lastError })
  };
}

test("crawl worker creates a crawl run when legacy crawl_seed payload has no crawlRunId", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const result = await runCrawlWorkerCycle({
    apiClient: apiClientForStore(store),
    fetchImpl: async (url: string | URL | Request) => {
      const requestedUrl = String(url);
      if (requestedUrl.endsWith("/sitemap.xml")) {
        return new Response("<urlset><url><loc>https://example.com</loc></url></urlset>", { status: 200, headers: { "content-type": "application/xml" } });
      }
      return new Response("<html><head><title>Seed</title></head></html>", { status: 200, headers: { "content-type": "text/html" } });
    },
    now: () => "2026-06-03T10:00:00.000Z"
  });

  assert.equal(result.status, "succeeded");
  assert.equal(typeof result.crawlRunId, "string");
  const runs = envelopeData<Array<{ id: string; status: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/crawl-runs`));
  assert.equal(runs[0]?.id, result.crawlRunId);
  assert.equal(runs[0]?.status, "succeeded");
  await store.close();
});

test("crawl worker claims crawl_seed job and persists crawl artifacts end-to-end", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    if (requestedUrl.endsWith("/sitemap.xml")) {
      return new Response("<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>", { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (requestedUrl.endsWith("/b")) {
      return new Response("", { status: 500, headers: { "content-type": "text/html" } });
    }
    return new Response("<html><head><title>Fixture</title></head><body>ok</body></html>", { status: 200, headers: { "content-type": "text/html" } });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, now: () => "2026-06-03T10:00:00.000Z" });
  assert.equal(result.claimed, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.discoveredUrls, 3);
  assert.equal(result.fetchedUrls, 3);

  const runs = envelopeData<Array<{ status: string; summary: { discoveredUrls: number; fetchedUrls: number; indexabilityAssessments: number; openIssues: number; healthScore: number | null } }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/crawl-runs`));
  assert.equal(runs[0]?.status, "succeeded");
  assert.equal(runs[0]?.summary.discoveredUrls, 3);
  assert.equal(runs[0]?.summary.fetchedUrls, 3);
  assert.equal(runs[0]?.summary.indexabilityAssessments, 3);
  assert.equal((runs[0]?.summary.openIssues ?? 0) > 0, true);
  assert.equal(runs[0]?.summary.healthScore !== null, true);

  const issues = envelopeData<Array<{ rule: string; severity: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/audit-issues`));
  assert.equal(issues.some((issue) => issue.rule === "http_error" && issue.severity === "critical"), true);
  await store.close();
});

test("crawl worker checks limited in-scope outgoing links and records broken_link issues", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const fetched: string[] = [];
  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    fetched.push(requestedUrl);
    if (requestedUrl.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (requestedUrl.endsWith("/sitemap.xml")) {
      return new Response("<urlset><url><loc>https://example.com</loc></url></urlset>", { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (requestedUrl.endsWith("/missing")) {
      return new Response("missing", { status: 404, headers: { "content-type": "text/html" } });
    }
    return new Response('<html><head><title>Seed</title></head><body><a href="/missing">Missing</a><a href="https://outside.example/missing">External</a></body></html>', { status: 200, headers: { "content-type": "text/html" } });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, now: () => "2026-06-03T10:00:00.000Z", maxOutgoingLinkChecks: 5 });
  assert.equal(result.status, "succeeded");
  assert.equal(result.discoveredUrls, 1);
  assert.equal(result.fetchedUrls, 1);
  assert.equal(fetched.includes("https://example.com/missing"), true);
  assert.equal(fetched.includes("https://outside.example/missing"), false);

  const issues = envelopeData<Array<{ rule: string; url: string; message: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/audit-issues`));
  assert.equal(issues.some((issue) => issue.rule === "broken_link" && issue.url === "https://example.com/" && issue.message.includes("https://example.com/missing")), true);
  await store.close();
});

test("crawl worker accepts a valid sitemap that only contains the seed URL", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const fetched: string[] = [];
  const result = await runCrawlWorkerCycle({
    apiClient: apiClientForStore(store),
    fetchImpl: async (url: string | URL | Request) => {
      const requestedUrl = String(url);
      fetched.push(requestedUrl);
      if (requestedUrl.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nAllow: /\n", { status: 200 });
      }
      if (requestedUrl.endsWith("/sitemap.xml")) {
        return new Response("<urlset><url><loc>https://example.com</loc></url></urlset>", { status: 200 });
      }
      return new Response("<html><head><title>Seed</title></head></html>", { status: 200 });
    },
    now: () => "2026-06-03T10:00:00.000Z"
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.discoveredUrls, 1);
  assert.equal(result.fetchedUrls, 1);
  assert.equal(fetched.includes("https://example.com/"), true);
  await store.close();
});


test("crawl worker marks invalid successful sitemap jobs as failed", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const result = await runCrawlWorkerCycle({
    apiClient: apiClientForStore(store),
    fetchImpl: async () => new Response("not xml", { status: 200 }),
    now: () => "2026-06-03T10:00:00.000Z"
  });

  assert.equal(result.status, "failed");
  assert.match(result.errorMessage ?? "", /invalid sitemap/);
  const jobs = envelopeData<Array<{ status: string }>>(await app("GET", "/jobs"));
  assert.equal(jobs.find((job) => job.status === "failed")?.status, "failed");
  await store.close();
});


test("crawl worker resolves in-scope sitemap indexes into persisted page URLs", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const fetched: string[] = [];
  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    fetched.push(requestedUrl);
    if (requestedUrl.endsWith("/sitemap.xml")) {
      return new Response("<sitemapindex><sitemap><loc>https://example.com/content-sitemap.xml</loc></sitemap><sitemap><loc>https://outside.example/private.xml</loc></sitemap></sitemapindex>", { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (requestedUrl.endsWith("/content-sitemap.xml")) {
      return new Response("<urlset><url><loc>https://example.com/features</loc></url><url><loc>https://example.com/pricing</loc></url></urlset>", { status: 200, headers: { "content-type": "application/xml" } });
    }
    return new Response("<html><head><title>Seed</title></head></html>", { status: 200, headers: { "content-type": "text/html" } });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, now: () => "2026-06-04T10:00:00.000Z" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.discoveredUrls, 3);
  assert.equal(fetched.includes("https://example.com/content-sitemap.xml"), true);
  assert.equal(fetched.includes("https://outside.example/private.xml"), false);

  const urls = envelopeData<Array<{ normalizedUrl: string; discoveredFrom: string | null }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/discovered-urls`));
  assert.deepEqual(urls.map((url) => url.normalizedUrl), ["https://example.com/", "https://example.com/features", "https://example.com/pricing"]);
  assert.equal(urls[1]?.discoveredFrom, "https://example.com/content-sitemap.xml");
  await store.close();
});

test("crawl worker keeps out-of-scope sitemap URLs out of the persisted crawl", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const fetched: string[] = [];
  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    fetched.push(requestedUrl);
    if (requestedUrl.endsWith("/sitemap.xml")) {
      return new Response("<urlset><url><loc>https://outside.example/private</loc></url></urlset>", { status: 200, headers: { "content-type": "application/xml" } });
    }
    return new Response("<html><head><title>Seed</title></head></html>", { status: 200, headers: { "content-type": "text/html" } });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, now: () => "2026-06-03T10:00:00.000Z" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.discoveredUrls, 1);
  assert.equal(fetched.includes("https://outside.example/private"), false);

  const urls = envelopeData<Array<{ normalizedUrl: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/discovered-urls`));
  assert.deepEqual(urls.map((url) => url.normalizedUrl), ["https://example.com/"]);
  await store.close();
});

test("crawl worker persists network-error fetches and keeps the run explainable", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    if (requestedUrl.endsWith("/sitemap.xml")) {
      return new Response("<urlset><url><loc>https://example.com/down</loc></url></urlset>", { status: 200 });
    }
    if (requestedUrl.endsWith("/down")) {
      throw new Error("connection reset");
    }
    return new Response("<html><head><title>Seed</title></head></html>", { status: 200 });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, retry: { maxAttempts: 2 }, now: () => "2026-06-03T10:00:00.000Z" });
  assert.equal(result.status, "succeeded");

  const urls = envelopeData<Array<{ id: string; normalizedUrl: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/discovered-urls`));
  const downUrl = urls.find((url) => url.normalizedUrl === "https://example.com/down");
  assert.ok(downUrl);
  const fetches = envelopeData<Array<{ statusClass: string; errorMessage?: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/discovered-urls/${downUrl.id}/fetch-results`));
  assert.equal(fetches[0]?.statusClass, "network_error");
  assert.match(fetches[0]?.errorMessage ?? "", /after 2 attempts/);

  const issues = envelopeData<Array<{ rule: string; url: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/audit-issues`));
  assert.equal(issues.some((issue) => issue.rule === "http_error" && issue.url === "https://example.com/down"), true);
  await store.close();
});


test("crawl worker records robots-blocked URLs as non-indexable without fetching the page", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", {
    projectId,
    type: "crawl_seed",
    subject: "https://example.com",
    payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" }
  });

  const fetched: string[] = [];
  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    fetched.push(requestedUrl);
    if (requestedUrl.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nDisallow: /blocked\n", { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (requestedUrl.endsWith("/sitemap.xml")) {
      return new Response("<urlset><url><loc>https://example.com/blocked/page</loc></url></urlset>", { status: 200, headers: { "content-type": "application/xml" } });
    }
    return new Response("<html><head><title>Seed</title></head></html>", { status: 200, headers: { "content-type": "text/html" } });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, now: () => "2026-06-04T10:00:00.000Z" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.discoveredUrls, 2);
  assert.equal(result.fetchedUrls, 1);
  assert.equal(fetched.includes("https://example.com/blocked/page"), false);

  const urls = envelopeData<Array<{ id: string; normalizedUrl: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/discovered-urls`));
  const blockedUrl = urls.find((url) => url.normalizedUrl === "https://example.com/blocked/page");
  assert.ok(blockedUrl);
  const assessments = envelopeData<Array<{ state: string; isIndexable: boolean; fetchResultId: string | null }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/discovered-urls/${blockedUrl.id}/indexability`));
  assert.equal(assessments[0]?.state, "blocked_by_robots");
  assert.equal(assessments[0]?.isIndexable, false);
  assert.equal(assessments[0]?.fetchResultId, null);
  await store.close();
});

function envelopeData<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}
