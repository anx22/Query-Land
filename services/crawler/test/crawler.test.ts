import assert from "node:assert/strict";
import test from "node:test";
import { assessIndexability, calculateHealthScore, discoverUrlsFromSitemap, evaluateAuditIssues, fetchUrl } from "../src/index.js";

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
