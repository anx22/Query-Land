import assert from "node:assert/strict";
import test from "node:test";
import { computeCrawlRunDiff, type AuditIssueRecord, type CrawlRun, type DiscoveredUrl } from "../src/crawl.js";

function run(overrides: Partial<CrawlRun> & Pick<CrawlRun, "id" | "startedAt">): CrawlRun {
  return {
    id: overrides.id,
    projectId: "proj-1",
    siteId: "site-1",
    status: "succeeded",
    trigger: "manual",
    startedAt: overrides.startedAt,
    finishedAt: overrides.finishedAt ?? null,
    summary: overrides.summary ?? { discoveredUrls: 0, fetchedUrls: 0, indexabilityAssessments: 0, openIssues: 0, healthScore: null },
    errorMessage: overrides.errorMessage
  };
}

function issue(overrides: Partial<AuditIssueRecord> & Pick<AuditIssueRecord, "id" | "detectedAt">): AuditIssueRecord {
  return {
    id: overrides.id,
    projectId: "proj-1",
    siteId: "site-1",
    discoveredUrlId: overrides.discoveredUrlId ?? null,
    url: overrides.url ?? "https://example.com/page",
    rule: overrides.rule ?? "missing_title",
    severity: overrides.severity ?? "medium",
    message: overrides.message ?? "issue",
    detectedAt: overrides.detectedAt,
    resolvedAt: overrides.resolvedAt ?? null,
    dismissedAt: overrides.dismissedAt ?? null
  };
}

function url(id: string, discoveredAt: string): DiscoveredUrl {
  return {
    id,
    projectId: "proj-1",
    siteId: "site-1",
    url: `https://example.com/${id}`,
    normalizedUrl: `https://example.com/${id}`,
    source: "link",
    discoveredFrom: null,
    depth: 1,
    discoveredAt
  };
}

const T1 = "2026-01-01T00:00:00.000Z"; // base as-of
const T2 = "2026-02-01T00:00:00.000Z"; // compare as-of

const baseRun = run({ id: "run-base", startedAt: "2025-12-31T00:00:00.000Z", finishedAt: T1, summary: { discoveredUrls: 10, fetchedUrls: 8, indexabilityAssessments: 8, openIssues: 3, healthScore: 70 } });
const compareRun = run({ id: "run-compare", startedAt: "2026-01-31T00:00:00.000Z", finishedAt: T2, summary: { discoveredUrls: 15, fetchedUrls: 12, indexabilityAssessments: 12, openIssues: 4, healthScore: 82 } });

test("computeCrawlRunDiff classifies appeared, fixed and persisting issues", () => {
  const issues: AuditIssueRecord[] = [
    // appeared: detected after base, before compare, still open
    issue({ id: "i-appeared", detectedAt: "2026-01-15T00:00:00.000Z" }),
    // fixed: open at base, resolved before compare
    issue({ id: "i-fixed", detectedAt: "2025-12-01T00:00:00.000Z", resolvedAt: "2026-01-20T00:00:00.000Z" }),
    // persisting: open at both
    issue({ id: "i-persist", detectedAt: "2025-11-01T00:00:00.000Z" }),
    // dismissed before base -> open at neither, ignored
    issue({ id: "i-old-dismissed", detectedAt: "2025-10-01T00:00:00.000Z", dismissedAt: "2025-12-15T00:00:00.000Z" }),
    // detected after compare -> open at neither, ignored
    issue({ id: "i-future", detectedAt: "2026-03-01T00:00:00.000Z" })
  ];

  const diff = computeCrawlRunDiff(baseRun, compareRun, issues, []);

  assert.deepEqual(diff.appearedIssues.map((i) => i.id), ["i-appeared"]);
  assert.deepEqual(diff.fixedIssues.map((i) => i.id), ["i-fixed"]);
  assert.equal(diff.persistingCount, 1);
  assert.equal(diff.baseRunId, "run-base");
  assert.equal(diff.compareRunId, "run-compare");
  assert.equal(diff.baseAsOf, T1);
  assert.equal(diff.compareAsOf, T2);
});

test("issue dismissed exactly at a run's as-of is treated as closed (resolvedAt/dismissedAt > T required)", () => {
  // resolvedAt == T means NOT open as of T (boundary).
  const resolvedAtCompare = issue({ id: "i-edge", detectedAt: "2026-01-10T00:00:00.000Z", resolvedAt: T2 });
  const diff = computeCrawlRunDiff(baseRun, compareRun, [resolvedAtCompare], []);
  // open at base? detected after base -> no. open at compare? resolvedAt == T2 -> not open. So neither.
  assert.equal(diff.appearedIssues.length, 0);
  assert.equal(diff.fixedIssues.length, 0);
  assert.equal(diff.persistingCount, 0);
});

test("computeCrawlRunDiff selects newUrls discovered in (baseAsOf, compareAsOf]", () => {
  const urls = [
    url("before", "2025-12-15T00:00:00.000Z"), // <= base -> excluded
    url("at-base", T1), // == base -> excluded (exclusive lower bound)
    url("between", "2026-01-15T00:00:00.000Z"), // included
    url("at-compare", T2), // == compare -> included (inclusive upper bound)
    url("after", "2026-03-01T00:00:00.000Z") // > compare -> excluded
  ];
  const diff = computeCrawlRunDiff(baseRun, compareRun, [], urls);
  assert.deepEqual(diff.newUrls.map((u) => u.id), ["between", "at-compare"]);
});

test("computeCrawlRunDiff computes null-safe summary deltas (compare - base)", () => {
  const diff = computeCrawlRunDiff(baseRun, compareRun, [], []);
  assert.deepEqual(diff.deltas, { healthScore: 12, openIssues: 1, discoveredUrls: 5 });
});

test("healthScore delta is null when either summary healthScore is null", () => {
  const baseNull = run({ ...baseRun, summary: { ...baseRun.summary, healthScore: null } });
  const diff = computeCrawlRunDiff(baseNull, compareRun, [], []);
  assert.equal(diff.deltas.healthScore, null);
  // non-null numeric deltas still computed
  assert.equal(diff.deltas.openIssues, 1);
});

test("computeCrawlRunDiff is robust to reversed arguments (chronological ordering)", () => {
  const issues: AuditIssueRecord[] = [
    issue({ id: "i-appeared", detectedAt: "2026-01-15T00:00:00.000Z" }),
    issue({ id: "i-fixed", detectedAt: "2025-12-01T00:00:00.000Z", resolvedAt: "2026-01-20T00:00:00.000Z" })
  ];
  // Pass newer run as `base` and older as `compare`; result must still be base(older)->compare(newer).
  const diff = computeCrawlRunDiff(compareRun, baseRun, issues, []);
  assert.equal(diff.baseRunId, "run-base");
  assert.equal(diff.compareRunId, "run-compare");
  assert.deepEqual(diff.appearedIssues.map((i) => i.id), ["i-appeared"]);
  assert.deepEqual(diff.fixedIssues.map((i) => i.id), ["i-fixed"]);
  assert.deepEqual(diff.deltas, { healthScore: 12, openIssues: 1, discoveredUrls: 5 });
});

test("computeCrawlRunDiff falls back to startedAt when finishedAt is null", () => {
  const runningBase = run({ id: "run-running", startedAt: T1, finishedAt: null, summary: baseRun.summary });
  const diff = computeCrawlRunDiff(runningBase, compareRun, [], []);
  assert.equal(diff.baseAsOf, T1);
});
