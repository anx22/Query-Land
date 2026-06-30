/**
 * Executable real-site crawl smoke runner.
 *
 * This is a SCRIPT, not a test. It is intentionally NOT named `*.test.ts` so it
 * is never picked up by `npm test` / `npm run check` — CI must stay deterministic
 * and network-free. Run it manually via `SMOKE_BASE_URL=... npm run smoke:crawl`.
 *
 * It performs a real end-to-end `crawl_seed` cycle (real `fetch`, real
 * robots.txt + User-Agent handling) against a configurable target site, persists
 * artifacts into a store (DATABASE_URL if set, else a throwaway PGlite file),
 * then asserts explicit success criteria and prints a structured PASS/FAIL
 * report. Exits 0 only if every criterion passes.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, createStore, type Store } from "@seo-tool/api";
import { DEFAULT_CRAWLER_USER_AGENT } from "./config.js";
import { runCrawlWorkerCycle } from "./crawl-cycle.js";
import type { CrawlWorkerApiClient, CrawlWorkerCycleResult } from "./types.js";

/** Per-artifact counts read back after a cycle — the surface the criteria assert. */
export interface SmokeSnapshot {
  cycle: CrawlWorkerCycleResult;
  discoveredUrls: number;
  fetchResults: number;
  indexabilityAssessments: number;
  crawlRunCompleted: boolean;
  crawlRunSummaryPresent: boolean;
  healthScore: number | null;
}

export interface SmokeCriterion {
  name: string;
  pass: boolean;
  detail: string;
}

export interface SmokeEvaluation {
  passed: boolean;
  criteria: SmokeCriterion[];
}

/**
 * Pure, network-free evaluation of smoke success criteria.
 *
 * Thresholds are deliberately lenient so a minimal 1-page site (e.g.
 * example.com, no sitemap, no links) still passes: discovered>=1, fetched>=1.
 */
export function evaluateSmokeCriteria(snapshot: SmokeSnapshot): SmokeEvaluation {
  const criteria: SmokeCriterion[] = [
    {
      name: "job_claimed_and_succeeded",
      pass: snapshot.cycle.claimed === true && snapshot.cycle.status === "succeeded",
      detail: `claimed=${snapshot.cycle.claimed} status=${snapshot.cycle.status ?? "none"}${snapshot.cycle.errorMessage ? ` error=${snapshot.cycle.errorMessage}` : ""}`
    },
    {
      name: "discovered_urls",
      pass: snapshot.discoveredUrls >= 1,
      detail: `discovered=${snapshot.discoveredUrls} (>=1)`
    },
    {
      name: "fetch_results",
      pass: snapshot.fetchResults >= 1,
      detail: `fetchResults=${snapshot.fetchResults} (>=1)`
    },
    {
      name: "indexability_assessed",
      pass: snapshot.fetchResults >= 1 && snapshot.indexabilityAssessments >= snapshot.fetchResults,
      detail: `assessments=${snapshot.indexabilityAssessments} (>= fetchResults=${snapshot.fetchResults})`
    },
    {
      name: "crawl_run_completed_with_summary",
      pass: snapshot.crawlRunCompleted && snapshot.crawlRunSummaryPresent,
      detail: `completed=${snapshot.crawlRunCompleted} summary=${snapshot.crawlRunSummaryPresent}`
    },
    {
      name: "health_score_computed",
      pass: snapshot.healthScore !== null && Number.isFinite(snapshot.healthScore),
      detail: `healthScore=${snapshot.healthScore ?? "null"}`
    }
  ];
  return { passed: criteria.every((criterion) => criterion.pass), criteria };
}

interface CrawlRunRecord {
  id: string;
  status: string;
  summary: {
    discoveredUrls: number;
    fetchedUrls: number;
    indexabilityAssessments: number;
    openIssues: number;
    healthScore: number | null;
  } | null;
}

/** Bind the in-process API app to the CrawlWorkerApiClient interface (same shape as the test wiring). */
function apiClientForStore(store: Store): CrawlWorkerApiClient {
  const app = createApp(store);
  const post = async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await app("POST", path, body);
    assert.equal(response.status >= 200 && response.status < 300, true, `POST ${path} -> ${response.status}: ${JSON.stringify(response.body)}`);
    return (response.body as { data: T }).data;
  };
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

function printUsage(): void {
  console.log(
    [
      "crawl smoke runner — real end-to-end crawl_seed cycle against a real site.",
      "",
      "SMOKE_BASE_URL is required; without it this is a safe no-op (exit 0).",
      "",
      "Environment:",
      "  SMOKE_BASE_URL    (required) base URL of a site you OWN / have permission to crawl",
      "  SMOKE_SITEMAP_URL (optional) sitemap URL (default: <baseUrl>/sitemap.xml)",
      "  SMOKE_MAX_URLS    (optional) max URLs to fetch (default: 25)",
      "  SMOKE_PROJECT_ID  (optional) project id (default: proj-smoke)",
      "  SMOKE_SITE_ID     (optional) site id (default: site-smoke)",
      "  DATABASE_URL      (optional) store URL; if unset, a throwaway PGlite file is used and cleaned up",
      "",
      "Safety: only crawl sites you own. The crawler sends User-Agent",
      `  '${DEFAULT_CRAWLER_USER_AGENT}' (override via CRAWLER_USER_AGENT) and respects robots.txt.`,
      "",
      "Usage:",
      "  SMOKE_BASE_URL=https://example.com/ npm run smoke:crawl"
    ].join("\n")
  );
}

export async function runSmoke(): Promise<number> {
  const baseUrl = process.env.SMOKE_BASE_URL?.trim();
  if (!baseUrl) {
    printUsage();
    // Safe skip: an accidental CI/invocation without a target is a no-op success.
    return 0;
  }

  const sitemapUrl = process.env.SMOKE_SITEMAP_URL?.trim() || new URL("/sitemap.xml", baseUrl).toString();
  const maxUrls = Number(process.env.SMOKE_MAX_URLS ?? 25);
  const projectSlug = process.env.SMOKE_PROJECT_ID?.trim() || "crawl-smoke";
  const userAgent = process.env.CRAWLER_USER_AGENT || DEFAULT_CRAWLER_USER_AGENT;

  // Use the provided DATABASE_URL if present, else a throwaway PGlite file we clean up.
  let tempDbDir: string | null = null;
  let databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    tempDbDir = mkdtempSync(join(tmpdir(), "seo-crawl-smoke-"));
    databaseUrl = `pglite:${join(tempDbDir, "smoke-db")}`;
  }

  console.log(
    JSON.stringify({
      event: "crawl_smoke_start",
      baseUrl,
      sitemapUrl,
      maxUrls,
      projectSlug,
      userAgent,
      database: tempDbDir ? "throwaway-pglite" : "DATABASE_URL"
    })
  );

  const store = await createStore(databaseUrl);
  let exitCode = 1;
  try {
    const app = createApp(store);

    // Ensure the project + site exist (idempotent); the API rejects crawl-runs for
    // unknown sites. Use the real ids the API returns (created or pre-existing).
    const { projectId, siteId } = await ensureProjectAndSite(app, projectSlug, baseUrl);

    // Create the crawl run + crawl_seed job, then run a real cycle.
    const runResponse = await app("POST", `/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger: "manual" });
    assert.equal(runResponse.status >= 200 && runResponse.status < 300, true, `create crawl-run -> ${runResponse.status}: ${JSON.stringify(runResponse.body)}`);
    const crawlRunId = (runResponse.body as { data: { id: string } }).data.id;

    const jobResponse = await app("POST", "/jobs", {
      projectId,
      type: "crawl_seed",
      subject: baseUrl,
      payload: { siteId, baseUrl, crawlRunId, sitemapUrl }
    });
    assert.equal(jobResponse.status >= 200 && jobResponse.status < 300, true, `create job -> ${jobResponse.status}: ${JSON.stringify(jobResponse.body)}`);

    const cycle = await runCrawlWorkerCycle({
      apiClient: apiClientForStore(store),
      // Real network fetch (global fetch / undici) against the target site.
      fetchImpl: fetch,
      maxUrls,
      fetchTimeoutMs: Number(process.env.CRAWLER_FETCH_TIMEOUT_MS ?? 15000),
      retry: { maxAttempts: 2, delayMs: 200 },
      maxRedirects: 5,
      userAgent
    });

    // Read back persisted artifacts to build the snapshot. Fan the per-URL reads out in parallel
    // (one Promise.all) rather than awaiting two GETs serially per discovered URL.
    const discovered = (await getData<Array<{ id: string }>>(app, `/projects/${projectId}/sites/${siteId}/discovered-urls`)) ?? [];
    const perUrlCounts = await Promise.all(
      discovered.map(async (url) => {
        const [fetches, assessments] = await Promise.all([
          getData<unknown[]>(app, `/projects/${projectId}/sites/${siteId}/discovered-urls/${url.id}/fetch-results`),
          getData<unknown[]>(app, `/projects/${projectId}/sites/${siteId}/discovered-urls/${url.id}/indexability`)
        ]);
        return { fetches: (fetches ?? []).length, assessments: (assessments ?? []).length };
      })
    );
    const fetchResults = perUrlCounts.reduce((sum, c) => sum + c.fetches, 0);
    const indexabilityAssessments = perUrlCounts.reduce((sum, c) => sum + c.assessments, 0);

    const runs = (await getData<CrawlRunRecord[]>(app, `/projects/${projectId}/sites/${siteId}/crawl-runs`)) ?? [];
    const run = runs.find((candidate) => candidate.id === crawlRunId) ?? runs[0];

    const snapshot: SmokeSnapshot = {
      cycle,
      discoveredUrls: discovered.length,
      fetchResults,
      indexabilityAssessments,
      crawlRunCompleted: run?.status === "succeeded",
      crawlRunSummaryPresent: Boolean(run?.summary),
      healthScore: run?.summary?.healthScore ?? null
    };

    const evaluation = evaluateSmokeCriteria(snapshot);
    printReport(snapshot, evaluation);
    exitCode = evaluation.passed ? 0 : 1;
  } finally {
    await store.close();
    if (tempDbDir) {
      rmSync(tempDbDir, { recursive: true, force: true });
    }
  }
  return exitCode;
}

/** Create (or reuse) the project + site for the smoke target; returns their real ids. */
async function ensureProjectAndSite(
  app: ReturnType<typeof createApp>,
  projectSlug: string,
  baseUrl: string
): Promise<{ projectId: string; siteId: string }> {
  const createProject = await app("POST", "/projects", { name: `Crawl Smoke (${projectSlug})`, slug: projectSlug });
  let projectId: string;
  if (createProject.status >= 200 && createProject.status < 300) {
    projectId = (createProject.body as { data: { id: string } }).data.id;
  } else {
    const projects = (await getData<Array<{ id: string; slug: string }>>(app, "/projects")) ?? [];
    const existing = projects.find((project) => project.slug === projectSlug);
    assert.ok(existing, `could not create or find project '${projectSlug}' -> ${createProject.status}: ${JSON.stringify(createProject.body)}`);
    projectId = existing.id;
  }

  const createSite = await app("POST", `/projects/${projectId}/sites`, { baseUrl, scopeType: "domain" });
  if (createSite.status >= 200 && createSite.status < 300) {
    return { projectId, siteId: (createSite.body as { data: { id: string } }).data.id };
  }
  const sites = (await getData<Array<{ id: string; baseUrl: string }>>(app, `/projects/${projectId}/sites`)) ?? [];
  const existingSite = sites.find((site) => site.baseUrl === baseUrl) ?? sites[0];
  assert.ok(existingSite, `could not create or find site for ${baseUrl} -> ${createSite.status}: ${JSON.stringify(createSite.body)}`);
  return { projectId, siteId: existingSite.id };
}

async function getData<T>(app: ReturnType<typeof createApp>, path: string): Promise<T | null> {
  const response = await app("GET", path);
  if (response.status < 200 || response.status >= 300) {
    return null;
  }
  return (response.body as { data: T }).data;
}

function printReport(snapshot: SmokeSnapshot, evaluation: SmokeEvaluation): void {
  console.log(
    JSON.stringify({
      event: "crawl_smoke_report",
      counts: {
        discoveredUrls: snapshot.discoveredUrls,
        fetchResults: snapshot.fetchResults,
        indexabilityAssessments: snapshot.indexabilityAssessments,
        healthScore: snapshot.healthScore,
        crawlRunCompleted: snapshot.crawlRunCompleted,
        crawlRunSummaryPresent: snapshot.crawlRunSummaryPresent
      },
      cycle: snapshot.cycle
    })
  );
  console.log("");
  console.log("Smoke criteria:");
  for (const criterion of evaluation.criteria) {
    console.log(`  [${criterion.pass ? "PASS" : "FAIL"}] ${criterion.name} — ${criterion.detail}`);
  }
  console.log("");
  console.log(`Result: ${evaluation.passed ? "PASS" : "FAIL"}`);
}

if (process.env.NODE_ENV !== "test") {
  runSmoke()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(JSON.stringify({ event: "crawl_smoke_crash", message: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    });
}
