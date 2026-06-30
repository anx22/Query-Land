/**
 * Crawler audit harness — a battery of deterministic, network-free fixture
 * scenarios that exercise each crawl-engine behaviour end-to-end and report a
 * per-case PASS/FAIL diagnostic with actual-vs-expected detail.
 *
 * Why this exists (separate from the unit tests): it gives a single command to
 * run the whole crawl engine against synthetic "sites" and instantly see WHICH
 * behaviour broke and HOW — so regressions during ongoing development are caught
 * and fixed quickly. Every scenario uses an injected `fetchImpl` (no real
 * network) and an in-memory store, so it is fully reproducible.
 *
 * Two entry points share the same scenarios:
 *  - `runAuditScenarios()` — importable; asserted green by audit-harness.test.ts
 *    (keeps CI honest and network-free).
 *  - script mode (`npm run audit:crawl`) — prints the human-readable report and
 *    exits non-zero if any scenario fails.
 */
import { fileURLToPath } from "node:url";
import { createApp, createStore, type Store } from "@seo-tool/api";
import { runCrawlWorkerCycle } from "./crawl-cycle.js";
import type { CrawlScopeType } from "./url-normalization.js";
import type { CrawlWorkerApiClient, CrawlWorkerCycleOptions, CrawlWorkerCycleResult } from "./types.js";

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface HarnessCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface ScenarioResult {
  name: string;
  description: string;
  passed: boolean;
  checks: HarnessCheck[];
}

export interface HarnessReport {
  passed: boolean;
  scenarios: ScenarioResult[];
}

/** The observable surface a scenario asserts against, read back after one cycle. */
interface ScenarioRun {
  cycle: CrawlWorkerCycleResult;
  /** Every URL the crawler actually requested (robots/sitemap/pages/link-probes). */
  fetchLog: string[];
  discovered: Array<{ id: string; normalizedUrl: string; depth: number | null; source: string; discoveredFrom: string | null }>;
  issues: Array<{ rule: string; url: string; message: string; severity: string }>;
  /** First indexability assessment per discovered normalized URL. */
  assessmentByUrl: Map<string, { state: string; isIndexable: boolean }>;
}

interface Scenario {
  name: string;
  description: string;
  baseUrl?: string;
  sitemapUrl?: string;
  options?: Partial<Pick<CrawlWorkerCycleOptions, "maxUrls" | "maxDepth" | "scopeType" | "maxOutgoingLinkChecks" | "retry">>;
  /** Deterministic responder for a requested URL. May throw to simulate a network error. */
  fetch: (url: string) => Response | Promise<Response>;
  /** Optional decorator to inject failures (e.g. a store write that rejects). */
  wrapApiClient?: (base: CrawlWorkerApiClient) => CrawlWorkerApiClient;
  checks: (run: ScenarioRun) => HarnessCheck[];
}

// ---------------------------------------------------------------------------
// Fixture-response + assertion helpers (keep each scenario self-documenting)
// ---------------------------------------------------------------------------

const HTML = { "content-type": "text/html" } as const;
const XML = { "content-type": "application/xml" } as const;
const TEXT = { "content-type": "text/plain" } as const;

function page(title: string, links: string[] = []): Response {
  const body = `<html><head><title>${title}</title></head><body>${links.map((l) => `<a href="${l}">x</a>`).join("")}</body></html>`;
  return new Response(body, { status: 200, headers: HTML });
}
function rawPage(html: string): Response {
  return new Response(html, { status: 200, headers: HTML });
}
function httpStatus(code: number, body = ""): Response {
  return new Response(body, { status: code, headers: HTML });
}
function xml(body: string): Response {
  return new Response(body, { status: 200, headers: XML });
}
function robotsTxt(body: string): Response {
  return new Response(body, { status: 200, headers: TEXT });
}
function pathOf(url: string): string {
  const pathname = new URL(url).pathname;
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}

function check(label: string, pass: boolean, detail: string): HarnessCheck {
  return { label, pass, detail };
}
function expectEq(label: string, actual: unknown, expected: unknown): HarnessCheck {
  return { label, pass: Object.is(actual, expected), detail: `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}` };
}

/** Build a standard link-graph responder: robots allow-all, sitemap 404, pages = title+links. */
function graphFetch(graph: Record<string, string[]>): (url: string) => Response {
  return (url: string) => {
    if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nAllow: /\n");
    if (url.endsWith("/sitemap.xml")) return httpStatus(404, "missing");
    return page(pathOf(url), graph[pathOf(url)] ?? []);
  };
}

// ---------------------------------------------------------------------------
// Scenarios — one isolated crawl behaviour each
// ---------------------------------------------------------------------------

const LINK_GRAPH: Record<string, string[]> = { "/": ["/a", "/b"], "/a": ["/a1"], "/b": ["/", "/a"], "/a1": [] };

const SCENARIOS: Scenario[] = [
  {
    name: "bfs_full_graph",
    description: "Follows in-scope links breadth-first across the whole graph, deduped.",
    fetch: graphFetch(LINK_GRAPH),
    checks: ({ cycle }) => [
      expectEq("status", cycle.status, "succeeded"),
      expectEq("fetchedUrls", cycle.fetchedUrls, 4),
      expectEq("truncated", cycle.truncated, false)
    ]
  },
  {
    name: "depth_cap",
    description: "maxDepth stops link-following beyond the limit.",
    options: { maxDepth: 1 },
    fetch: graphFetch(LINK_GRAPH),
    checks: ({ cycle }) => [
      expectEq("status", cycle.status, "succeeded"),
      expectEq("fetchedUrls (seed + depth-1)", cycle.fetchedUrls, 3)
    ]
  },
  {
    name: "url_cap_truncation",
    description: "maxUrls caps the crawl and flags it as truncated.",
    options: { maxUrls: 2 },
    fetch: graphFetch(LINK_GRAPH),
    checks: ({ cycle }) => [
      expectEq("status", cycle.status, "succeeded"),
      expectEq("fetchedUrls", cycle.fetchedUrls, 2),
      expectEq("truncated", cycle.truncated, true)
    ]
  },
  {
    name: "per_url_error_boundary",
    description: "One page whose persist fails does not abort the whole run.",
    fetch: graphFetch(LINK_GRAPH),
    wrapApiClient: (base) => ({
      ...base,
      recordFetchResult: (projectId, siteId, discoveredUrlId, result) =>
        result.url.replace(/\/$/, "").endsWith("/b")
          ? Promise.reject(new Error("injected persist failure"))
          : base.recordFetchResult(projectId, siteId, discoveredUrlId, result)
    }),
    checks: ({ cycle }) => [
      expectEq("status", cycle.status, "succeeded"),
      check("pageErrors >= 1", (cycle.pageErrors ?? 0) >= 1, `pageErrors=${cycle.pageErrors ?? 0}`),
      check("fetchedUrls >= 3", (cycle.fetchedUrls ?? 0) >= 3, `fetchedUrls=${cycle.fetchedUrls ?? 0} (seed + /a + /a1 survive)`)
    ]
  },
  {
    name: "www_redirect_scope",
    description: "Seed redirect (apex → www) sets the effective base; links stay in scope.",
    fetch: (url) => {
      if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nAllow: /\n");
      if (url.endsWith("/sitemap.xml")) return httpStatus(404, "missing");
      const parsed = new URL(url);
      if (parsed.host === "example.com") {
        return new Response(null, { status: 301, headers: { location: `https://www.example.com${parsed.pathname}` } });
      }
      return page(pathOf(url), pathOf(url) === "/" ? ["/a"] : []);
    },
    checks: ({ cycle, discovered }) => [
      expectEq("status", cycle.status, "succeeded"),
      expectEq("fetchedUrls (www/ + www/a)", cycle.fetchedUrls, 2),
      check(
        "all discovered on www host",
        discovered.length > 0 && discovered.every((url) => safeHost(url.normalizedUrl) === "www.example.com"),
        `hosts=${JSON.stringify(discovered.map((url) => safeHost(url.normalizedUrl)))}`
      )
    ]
  },
  {
    name: "robots_disallow",
    description: "robots.txt-disallowed URL is recorded blocked_by_robots and never fetched.",
    fetch: (url) => {
      if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nDisallow: /blocked\n");
      if (url.endsWith("/sitemap.xml")) return xml("<urlset><url><loc>https://example.com</loc></url><url><loc>https://example.com/blocked/page</loc></url></urlset>");
      return page(pathOf(url));
    },
    checks: ({ cycle, fetchLog, assessmentByUrl }) => [
      expectEq("status", cycle.status, "succeeded"),
      expectEq("blocked assessment", assessmentByUrl.get("https://example.com/blocked/page")?.state, "blocked_by_robots"),
      check("blocked page not fetched", !fetchLog.includes("https://example.com/blocked/page"), `fetchLog=${JSON.stringify(fetchLog)}`)
    ]
  },
  {
    name: "nofollow_not_followed_but_audited",
    description: "rel=nofollow link is not followed for discovery but is still checked for breakage.",
    fetch: (url) => {
      if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nAllow: /\n");
      if (url.endsWith("/sitemap.xml")) return httpStatus(404, "missing");
      if (pathOf(url) === "/nf") return httpStatus(404, "gone");
      return rawPage('<html><head><title>Seed</title></head><body><a href="/nf" rel="nofollow">nf</a></body></html>');
    },
    checks: ({ cycle, fetchLog, issues }) => [
      expectEq("status", cycle.status, "succeeded"),
      expectEq("fetchedUrls (seed only)", cycle.fetchedUrls, 1),
      expectEq("discoveredUrls (frontier = seed only)", cycle.discoveredUrls, 1),
      check("nofollow target probed for breakage", fetchLog.includes("https://example.com/nf"), `fetchLog=${JSON.stringify(fetchLog)}`),
      check(
        "broken_link reported for nofollow target",
        issues.some((issue) => issue.rule === "broken_link" && issue.message.includes("https://example.com/nf")),
        `issues=${JSON.stringify(issues.map((i) => i.rule))}`
      )
    ]
  },
  {
    name: "comment_and_script_links_ignored",
    description: "Links inside HTML comments and <script> are not treated as real (DOM, not regex).",
    fetch: (url) => {
      if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nAllow: /\n");
      if (url.endsWith("/sitemap.xml")) return httpStatus(404, "missing");
      if (pathOf(url) === "/real") return page("/real");
      return rawPage(`<html><head><title>Seed</title></head><body>
        <!-- <a href="/ghost">ghost</a> -->
        <script>var s = '<a href="/from-script">x</a>';</script>
        <a href="/real">real</a>
      </body></html>`);
    },
    checks: ({ cycle, fetchLog }) => [
      expectEq("status", cycle.status, "succeeded"),
      expectEq("fetchedUrls (seed + /real only)", cycle.fetchedUrls, 2),
      check("ghost (commented) not fetched", !fetchLog.includes("https://example.com/ghost"), `fetchLog=${JSON.stringify(fetchLog)}`),
      check("script URL not fetched", !fetchLog.includes("https://example.com/from-script"), `fetchLog=${JSON.stringify(fetchLog)}`)
    ]
  },
  {
    name: "sitemap_index_scope",
    description: "In-scope sitemap-index children are resolved; out-of-scope sitemaps are skipped.",
    fetch: (url) => {
      if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nAllow: /\n");
      if (url.endsWith("/sitemap.xml")) return xml("<sitemapindex><sitemap><loc>https://example.com/content-sitemap.xml</loc></sitemap><sitemap><loc>https://outside.example/private.xml</loc></sitemap></sitemapindex>");
      if (url.endsWith("/content-sitemap.xml")) return xml("<urlset><url><loc>https://example.com/features</loc></url><url><loc>https://example.com/pricing</loc></url></urlset>");
      return page(pathOf(url));
    },
    checks: ({ cycle, fetchLog, discovered }) => [
      expectEq("status", cycle.status, "succeeded"),
      check("features discovered", discovered.some((url) => url.normalizedUrl === "https://example.com/features"), `urls=${JSON.stringify(discovered.map((u) => u.normalizedUrl))}`),
      check("pricing discovered", discovered.some((url) => url.normalizedUrl === "https://example.com/pricing"), "expected /pricing in discovered"),
      check("out-of-scope sitemap not fetched", !fetchLog.includes("https://outside.example/private.xml"), `fetchLog=${JSON.stringify(fetchLog)}`)
    ]
  },
  {
    name: "binary_resource_not_parsed",
    description: "An in-scope non-HTML resource is fetched but its body is never parsed for links.",
    fetch: (url) => {
      if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nAllow: /\n");
      if (url.endsWith("/sitemap.xml")) return httpStatus(404, "missing");
      if (pathOf(url) === "/asset") return new Response('<a href="/should-not-follow">x</a>', { status: 200, headers: { "content-type": "image/png" } });
      return page("/", ["/asset"]);
    },
    checks: ({ cycle, fetchLog }) => [
      expectEq("status", cycle.status, "succeeded"),
      check("binary body not parsed for links", !fetchLog.includes("https://example.com/should-not-follow"), `fetchLog=${JSON.stringify(fetchLog)}`),
      expectEq("fetchedUrls (seed + asset)", cycle.fetchedUrls, 2)
    ]
  },
  {
    name: "broken_link_and_scope",
    description: "In-scope 404 link yields broken_link; external link stays out of scope.",
    fetch: (url) => {
      if (url.endsWith("/robots.txt")) return robotsTxt("User-agent: *\nAllow: /\n");
      if (url.endsWith("/sitemap.xml")) return httpStatus(404, "missing");
      if (pathOf(url) === "/missing") return httpStatus(404, "gone");
      return rawPage('<html><head><title>Seed</title></head><body><a href="/missing">m</a><a href="https://outside.example/x">e</a></body></html>');
    },
    checks: ({ cycle, fetchLog, issues }) => [
      expectEq("status", cycle.status, "succeeded"),
      check(
        "broken_link reported for /missing",
        issues.some((issue) => issue.rule === "broken_link" && issue.message.includes("https://example.com/missing")),
        `issues=${JSON.stringify(issues.map((i) => i.rule))}`
      ),
      check("external link not fetched", !fetchLog.includes("https://outside.example/x"), `fetchLog=${JSON.stringify(fetchLog)}`)
    ]
  }
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runAuditScenarios(): Promise<HarnessReport> {
  const scenarios: ScenarioResult[] = [];
  for (let index = 0; index < SCENARIOS.length; index += 1) {
    scenarios.push(await runScenario(SCENARIOS[index]!, index));
  }
  return { passed: scenarios.every((scenario) => scenario.passed), scenarios };
}

async function runScenario(scenario: Scenario, index: number): Promise<ScenarioResult> {
  const baseUrl = scenario.baseUrl ?? "https://example.com";
  const sitemapUrl = scenario.sitemapUrl ?? new URL("/sitemap.xml", baseUrl).toString();
  const scopeType: CrawlScopeType = scenario.options?.scopeType ?? "domain";
  const fetchLog: string[] = [];
  const store = await createStore("sqlite::memory:");
  try {
    const app = createApp(store);
    const project = envelope<{ id: string }>(await app("POST", "/projects", { name: `Audit ${scenario.name}`, slug: `audit-${index}-${scenario.name.replace(/[^a-z0-9]+/gi, "-")}` }));
    const site = envelope<{ id: string }>(await app("POST", `/projects/${project.id}/sites`, { baseUrl, scopeType }));
    const run = envelope<{ id: string }>(await app("POST", `/projects/${project.id}/sites/${site.id}/crawl-runs`, { trigger: "manual" }));
    await app("POST", "/jobs", { projectId: project.id, type: "crawl_seed", subject: baseUrl, payload: { siteId: site.id, baseUrl, crawlRunId: run.id, sitemapUrl } });

    const fetchImpl = (async (url: string | URL | Request) => {
      const requested = String(url);
      fetchLog.push(requested);
      return scenario.fetch(requested);
    }) as typeof fetch;

    const baseClient = apiClientForStore(store);
    const apiClient = scenario.wrapApiClient ? scenario.wrapApiClient(baseClient) : baseClient;
    const cycle = await runCrawlWorkerCycle({ apiClient, fetchImpl, now: () => "2026-06-03T10:00:00.000Z", ...scenario.options });

    const base = `/projects/${project.id}/sites/${site.id}`;
    const discovered = (await getData<ScenarioRun["discovered"]>(app, `${base}/discovered-urls`)) ?? [];
    const issues = (await getData<ScenarioRun["issues"]>(app, `${base}/audit-issues`)) ?? [];
    const assessmentByUrl = new Map<string, { state: string; isIndexable: boolean }>();
    await Promise.all(
      discovered.map(async (url) => {
        const assessments = (await getData<Array<{ state: string; isIndexable: boolean }>>(app, `${base}/discovered-urls/${url.id}/indexability`)) ?? [];
        if (assessments[0]) assessmentByUrl.set(url.normalizedUrl, assessments[0]);
      })
    );

    const checks = scenario.checks({ cycle, fetchLog, discovered, issues, assessmentByUrl });
    return { name: scenario.name, description: scenario.description, checks, passed: checks.every((c) => c.pass) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { name: scenario.name, description: scenario.description, checks: [check("scenario_threw", false, detail)], passed: false };
  } finally {
    await store.close();
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "<invalid>";
  }
}

function envelope<T>(response: { status: number; body: unknown }): T {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`request failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return (response.body as { data: T }).data;
}

async function getData<T>(app: ReturnType<typeof createApp>, path: string): Promise<T | null> {
  const response = await app("GET", path);
  if (response.status < 200 || response.status >= 300) return null;
  return (response.body as { data: T }).data;
}

function apiClientForStore(store: Store): CrawlWorkerApiClient {
  const app = createApp(store);
  const post = async <T>(path: string, body?: unknown): Promise<T> => envelope<T>(await app("POST", path, body));
  return {
    claimNextJob: () => post("/jobs/claim", { type: "crawl_seed" }),
    createCrawlRun: (projectId, siteId, trigger) => post(`/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger }),
    recordDiscoveredUrls: (projectId, siteId, urls) => post(`/projects/${projectId}/sites/${siteId}/discovered-urls`, { urls }),
    recordFetchResult: (projectId, siteId, discoveredUrlId, result) => post(`/projects/${projectId}/sites/${siteId}/discovered-urls/${discoveredUrlId}/fetch-results`, result),
    recordIndexabilityAssessment: (projectId, siteId, discoveredUrlId, assessment) => post(`/projects/${projectId}/sites/${siteId}/discovered-urls/${discoveredUrlId}/indexability`, assessment),
    recordAuditIssues: (projectId, siteId, issues, checkedDiscoveredUrlIds) => post(`/projects/${projectId}/sites/${siteId}/audit-issues`, { issues, checkedDiscoveredUrlIds }),
    computeHealthScore: (projectId, siteId) => post(`/projects/${projectId}/sites/${siteId}/health-scores/compute`, {}),
    completeCrawlRun: (projectId, siteId, crawlRunId, status, errorMessage) => post(`/projects/${projectId}/sites/${siteId}/crawl-runs/${crawlRunId}/complete`, { status, errorMessage }),
    completeJob: (jobId, status, lastError) => post(`/jobs/${jobId}/complete`, { status, lastError })
  };
}

// ---------------------------------------------------------------------------
// Human-readable report + script entry point
// ---------------------------------------------------------------------------

function printReport(report: HarnessReport): void {
  console.log("Crawler audit harness — per-scenario behaviour report\n");
  for (const scenario of report.scenarios) {
    console.log(`${scenario.passed ? "PASS" : "FAIL"}  ${scenario.name} — ${scenario.description}`);
    for (const c of scenario.checks) {
      console.log(`        [${c.pass ? "ok" : "XX"}] ${c.label} — ${c.detail}`);
    }
  }
  const passedCount = report.scenarios.filter((scenario) => scenario.passed).length;
  console.log(`\nResult: ${report.passed ? "PASS" : "FAIL"} (${passedCount}/${report.scenarios.length} scenarios green)`);
}

// Run only when executed directly (`npm run audit:crawl`), NOT when imported by
// the test. Using main-module detection (rather than NODE_ENV) lets the script
// set NODE_ENV=test to silence the API request log while still running here.
const isMainModule = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  runAuditScenarios()
    .then((report) => {
      printReport(report);
      process.exitCode = report.passed ? 0 : 1;
    })
    .catch((error: unknown) => {
      console.error(JSON.stringify({ event: "crawl_audit_crash", message: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    });
}
