import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CRAWLER_USER_AGENT, assessIndexability, backoffDelayMs, calculateHealthScore, discoverUrlsFromSitemap, discoverUrlsFromSitemapIndex, evaluateAuditIssues, extractOutgoingLinks, fetchUrl, hasRepeatedSegments, isInCrawlScope, isRobotsAllowed, loadRobotsPolicy, normalizeCrawlUrl, parsePage, parseRobotsTxt, robotsCrawlDelaySeconds } from "../src/index.js";

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


test("parsePage ignores links inside comments, scripts and styles (DOM, not regex)", () => {
  const html = `
    <html><body>
      <!-- <a href="/commented-out">ghost</a> -->
      <script>var s = '<a href="/from-script">x</a>';</script>
      <style>.x { background: url('/from-style'); }</style>
      <a href="/real">real</a>
    </body></html>`;
  assert.deepEqual(parsePage(html, "https://example.com/").links.map((l) => l.url), ["https://example.com/real"]);
});

test("parsePage resolves relative links against <base href>", () => {
  const html = `<html><head><base href="https://example.com/sub/"></head><body><a href="page">P</a><a href="../top">T</a></body></html>`;
  assert.deepEqual(parsePage(html, "https://example.com/other/where").links.map((l) => l.url), ["https://example.com/sub/page", "https://example.com/top"]);
});

test("parsePage flags rel=nofollow links and decodes entity-encoded hrefs", () => {
  const html = `<a href="/keep?a=1&amp;b=2">k</a><a href="/skip" rel="nofollow ugc">s</a>`;
  const links = parsePage(html, "https://example.com/").links;
  assert.deepEqual(links, [
    { url: "https://example.com/keep?a=1&b=2", nofollow: false },
    { url: "https://example.com/skip", nofollow: true }
  ]);
});

test("parsePage extracts canonical/robots/title robustly (token rel, multi-space title)", () => {
  const html = `<html><head>
    <title>  Spaced   &amp;   Title  </title>
    <link rel="alternate canonical" href="https://example.com/canon">
    <meta name="ROBOTS" content="noindex, follow">
  </head></html>`;
  const parsed = parsePage(html, "https://example.com/x");
  assert.equal(parsed.title, "Spaced & Title");
  assert.equal(parsed.canonicalUrl, "https://example.com/canon");
  assert.equal(parsed.robotsMeta, "noindex, follow");
});

test("crawl frontier does not follow rel=nofollow links but still audits them for breakage", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", { projectId, type: "crawl_seed", subject: "https://example.com", payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" } });

  const fetched: string[] = [];
  const fetchImpl = async (url: string | URL | Request) => {
    const requestedUrl = String(url);
    fetched.push(requestedUrl);
    if (requestedUrl.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } });
    if (requestedUrl.endsWith("/sitemap.xml")) return new Response("missing", { status: 404, headers: { "content-type": "text/html" } });
    if (requestedUrl.endsWith("/nofollowed")) return new Response("gone", { status: 404, headers: { "content-type": "text/html" } });
    return new Response('<html><head><title>Seed</title></head><body><a href="/nofollowed" rel="nofollow">nf</a></body></html>', { status: 200, headers: { "content-type": "text/html" } });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, now: () => "2026-06-03T10:00:00.000Z", maxOutgoingLinkChecks: 5 });
  assert.equal(result.status, "succeeded");
  // The nofollow target is NOT followed into the frontier (seed only is fetched as a page)…
  assert.equal(result.fetchedUrls, 1);
  assert.equal(result.discoveredUrls, 1);
  // …but the broken-link audit still probes it and reports the 404.
  assert.equal(fetched.includes("https://example.com/nofollowed"), true);
  const issues = envelopeData<Array<{ rule: string; message: string }>>(await app("GET", `/projects/${projectId}/sites/${siteId}/audit-issues`));
  assert.equal(issues.some((issue) => issue.rule === "broken_link" && issue.message.includes("https://example.com/nofollowed")), true);
  await store.close();
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

test("robots wildcard (*) and end-anchor ($) path matching", () => {
  const policy = {
    fetchedUrl: "https://example.com/robots.txt",
    rules: parseRobotsTxt("User-agent: *\nDisallow: /*.pdf$\nDisallow: /private/*/secret\n")
  };
  assert.equal(isRobotsAllowed("https://example.com/file.pdf", policy), false); // *.pdf$ matches
  assert.equal(isRobotsAllowed("https://example.com/file.pdf?x=1", policy), true); // $ anchors end → query means no match
  assert.equal(isRobotsAllowed("https://example.com/a/b/file.pdf", policy), false); // * spans path segments
  assert.equal(isRobotsAllowed("https://example.com/private/a/secret", policy), false); // /private/*/secret matches
  assert.equal(isRobotsAllowed("https://example.com/private/secret", policy), true); // no middle segment → no match
});

test("robots Crawl-delay is parsed per group with wildcard fallback", async () => {
  const policy = await loadRobotsPolicy({
    baseUrl: "https://example.com",
    fetchImpl: async () => new Response("User-agent: *\nCrawl-delay: 2\nUser-agent: SeoToolBot\nCrawl-delay: 5\n", { status: 200, headers: { "content-type": "text/plain" } })
  });
  assert.equal(robotsCrawlDelaySeconds(policy, "SeoToolBot/1.0"), 5); // specific group
  assert.equal(robotsCrawlDelaySeconds(policy, "OtherBot/9"), 2); // wildcard fallback
});

test("robots Sitemap: directives are collected and absolutized", async () => {
  const policy = await loadRobotsPolicy({
    baseUrl: "https://example.com",
    fetchImpl: async () => new Response("Sitemap: https://example.com/sm1.xml\nSitemap: /sm2.xml\nUser-agent: *\nDisallow:\n", { status: 200, headers: { "content-type": "text/plain" } })
  });
  assert.deepEqual(policy.sitemaps, ["https://example.com/sm1.xml", "https://example.com/sm2.xml"]);
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

test("fetchUrl does not read binary (non-textual) response bodies", async () => {
  const result = await fetchUrl({
    url: "https://example.com/logo.png",
    fetchImpl: async () => new Response("\x89PNG\r\n\x1a\n binary bytes", { status: 200, headers: { "content-type": "image/png" } })
  });
  assert.equal(result.statusClass, "success");
  assert.equal(result.headers["content-type"], "image/png");
  assert.equal(result.responseBody, ""); // body discarded, never fed to the HTML parser
});

test("fetchUrl decodes non-UTF-8 bodies using the declared charset", async () => {
  // 0xE4 is 'ä' in ISO-8859-1; naive UTF-8 decoding would mangle it.
  const body = Buffer.from([0x3c, 0x70, 0x3e, 0xe4, 0x3c, 0x2f, 0x70, 0x3e]); // <p>ä</p>
  const result = await fetchUrl({
    url: "https://example.com/latin1",
    fetchImpl: async () => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=iso-8859-1" } })
  });
  assert.equal(result.responseBody, "<p>ä</p>");
});

test("fetchUrl caps the response body at maxBodyBytes", async () => {
  const result = await fetchUrl({
    url: "https://example.com/huge",
    maxBodyBytes: 4,
    fetchImpl: async () => new Response("0123456789", { status: 200, headers: { "content-type": "text/plain" } })
  });
  assert.equal(result.responseBody, "0123");
});

test("fetchUrl sends an Accept header preferring HTML/XML", async () => {
  let accept: string | null = null;
  await fetchUrl({
    url: "https://example.com/",
    fetchImpl: async (_url, init) => {
      accept = new Headers(init?.headers).get("accept");
      return new Response("ok", { status: 200 });
    }
  });
  assert.match(accept ?? "", /^text\/html/);
});

test("fetchUrl on garbage/invalid sitemap content still classifies without throwing", async () => {
  const result = await fetchUrl({
    url: "https://example.com/sitemap.xml",
    fetchImpl: async () => new Response("<<<not xml>>>", { status: 200 })
  });
  assert.equal(result.statusClass, "success");
  assert.equal(result.responseBody, "<<<not xml>>>");
});


test("normalizeCrawlUrl strips tracking params and sorts the rest for stable dedupe", () => {
  assert.equal(normalizeCrawlUrl("https://example.com/p?utm_source=x&b=2&a=1&gclid=y", "https://example.com"), "https://example.com/p?a=1&b=2");
  assert.equal(normalizeCrawlUrl("https://example.com/p?utm_campaign=x", "https://example.com"), "https://example.com/p");
  // meaningful params are preserved (only known trackers are dropped).
  assert.equal(normalizeCrawlUrl("https://example.com/p?id=5&page=2", "https://example.com"), "https://example.com/p?id=5&page=2");
});

test("hasRepeatedSegments detects spider-trap paths", () => {
  assert.equal(hasRepeatedSegments("/a/a/a"), true);
  assert.equal(hasRepeatedSegments("/shop/shop"), false); // 2 consecutive is allowed (maxRepeats=2)
  assert.equal(hasRepeatedSegments("/blog/blog-post"), false); // distinct segments
  assert.equal(hasRepeatedSegments("/a/b/c/d"), false);
});

test("crawl worker waits the robots Crawl-delay between same-host fetches", async () => {
  const store = await createStore("sqlite::memory:");
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", { projectId, type: "crawl_seed", subject: "https://example.com", payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" } });

  const delays: number[] = [];
  const fetchImpl = async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/robots.txt")) return new Response("User-agent: *\nCrawl-delay: 2\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } });
    if (u.endsWith("/sitemap.xml")) return new Response("missing", { status: 404, headers: { "content-type": "text/html" } });
    const path = new URL(u).pathname === "/" ? "/" : new URL(u).pathname.replace(/\/$/, "");
    const links = path === "/" ? '<a href="/a">a</a>' : "";
    return new Response(`<html><head><title>${path}</title></head><body>${links}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
  };

  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl, now: () => "2026-06-03T10:00:00.000Z", sleep: async (ms: number) => { delays.push(ms); } });
  assert.equal(result.status, "succeeded");
  assert.equal(result.fetchedUrls, 2); // seed + /a
  assert.ok(delays.includes(2000), `expected a 2000ms politeness wait before the same-host fetch, got ${JSON.stringify(delays)}`);
  await store.close();
});

test("crawl scope is scheme- and www-tolerant with domain/subdomain/folder modes", () => {
  // domain (default): apex + www + any subdomain; scheme-tolerant.
  assert.equal(isInCrawlScope("https://example.com/a", "https://example.com"), true);
  assert.equal(isInCrawlScope("http://example.com/a", "https://example.com"), true); // http↔https same site
  assert.equal(isInCrawlScope("https://www.example.com/a", "https://example.com"), true); // www == apex
  assert.equal(isInCrawlScope("https://blog.example.com/a", "https://example.com", "domain"), true); // subdomain in domain scope
  assert.equal(isInCrawlScope("https://other.example/a", "https://example.com"), false);
  assert.equal(isInCrawlScope("ftp://example.com/a", "https://example.com"), false); // non-http(s)

  // subdomain: exactly the base host (modulo www), no other subdomains.
  assert.equal(isInCrawlScope("https://www.example.com/a", "https://example.com", "subdomain"), true);
  assert.equal(isInCrawlScope("https://blog.example.com/a", "https://example.com", "subdomain"), false);

  // folder: same host + path prefix.
  assert.equal(isInCrawlScope("https://example.com/shop/x", "https://example.com/shop", "folder"), true);
  assert.equal(isInCrawlScope("https://example.com/blog/x", "https://example.com/shop", "folder"), false);
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

/** Build a deterministic fetchImpl for an in-memory link graph (no sitemap; robots allow-all). */
function linkGraphFetchImpl(graph: Record<string, string[]>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } });
    if (u.endsWith("/sitemap.xml")) return new Response("missing", { status: 404, headers: { "content-type": "text/html" } });
    const path = new URL(u).pathname === "/" ? "/" : new URL(u).pathname.replace(/\/$/, "");
    const links = graph[path] ?? [];
    const body = `<html><head><title>${path}</title></head><body>${links.map((l) => `<a href="${l}">x</a>`).join("")}</body></html>`;
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
}

const LINK_GRAPH: Record<string, string[]> = { "/": ["/a", "/b"], "/a": ["/a1"], "/b": ["/", "/a"], "/a1": [] };

async function seedGraphJob(store: Store) {
  const { app, projectId, siteId } = await setupSite(store);
  const run = envelopeData<{ id: string }>(await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" }));
  await app("POST", "/jobs", { projectId, type: "crawl_seed", subject: "https://example.com", payload: { siteId, baseUrl: "https://example.com", crawlRunId: run.id, sitemapUrl: "https://example.com/sitemap.xml" } });
  return { app, projectId, siteId };
}

test("crawl worker follows in-scope links (BFS) across the whole link graph", async () => {
  const store = await createStore("sqlite::memory:");
  await seedGraphJob(store);
  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl: linkGraphFetchImpl(LINK_GRAPH), now: () => "2026-06-03T10:00:00.000Z" });
  assert.equal(result.status, "succeeded");
  // seed + /a + /b + /a1 (reached via /a) — BFS, deduped (/b links back to / and /a).
  assert.equal(result.fetchedUrls, 4);
  assert.equal(result.truncated, false);
  await store.close();
});

test("crawl worker honors maxDepth (does not follow links beyond the limit)", async () => {
  const store = await createStore("sqlite::memory:");
  await seedGraphJob(store);
  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl: linkGraphFetchImpl(LINK_GRAPH), now: () => "2026-06-03T10:00:00.000Z", maxDepth: 1 });
  assert.equal(result.status, "succeeded");
  // depth 0 seed → depth 1 /a,/b; /a1 (depth 2) is NOT followed.
  assert.equal(result.fetchedUrls, 3);
  await store.close();
});

test("crawl worker truncates at maxUrls and flags it", async () => {
  const store = await createStore("sqlite::memory:");
  await seedGraphJob(store);
  const result = await runCrawlWorkerCycle({ apiClient: apiClientForStore(store), fetchImpl: linkGraphFetchImpl(LINK_GRAPH), now: () => "2026-06-03T10:00:00.000Z", maxUrls: 2 });
  assert.equal(result.status, "succeeded");
  assert.equal(result.fetchedUrls, 2);
  assert.equal(result.truncated, true);
  await store.close();
});

test("crawl worker per-URL error boundary: one failing page does not abort the run", async () => {
  const store = await createStore("sqlite::memory:");
  await seedGraphJob(store);
  const base = apiClientForStore(store);
  // Make persisting the fetch of /b fail; the run must still crawl seed + /a + /a1.
  const apiClient: CrawlWorkerApiClient = {
    ...base,
    recordFetchResult: (projectId, siteId, discoveredUrlId, result) =>
      result.url.replace(/\/$/, "").endsWith("/b") ? Promise.reject(new Error("boom")) : base.recordFetchResult(projectId, siteId, discoveredUrlId, result)
  };
  const result = await runCrawlWorkerCycle({ apiClient, fetchImpl: linkGraphFetchImpl(LINK_GRAPH), now: () => "2026-06-03T10:00:00.000Z" });
  assert.equal(result.status, "succeeded");
  assert.ok((result.pageErrors ?? 0) >= 1, "the failing page is counted as a per-URL error");
  assert.ok((result.fetchedUrls ?? 0) >= 3, "seed + /a + /a1 still crawled despite /b failing");
  await store.close();
});

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
  // BFS now follows the in-scope link: seed + /missing are both discovered and fetched.
  assert.equal(result.discoveredUrls, 2);
  assert.equal(result.fetchedUrls, 2);
  assert.equal(fetched.includes("https://example.com/missing"), true);
  assert.equal(fetched.includes("https://outside.example/missing"), false); // external stays out of scope

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
