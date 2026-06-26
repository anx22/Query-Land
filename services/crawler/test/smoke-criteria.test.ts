import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSmokeCriteria, type SmokeSnapshot } from "../src/smoke.js";

function baseSnapshot(overrides: Partial<SmokeSnapshot> = {}): SmokeSnapshot {
  return {
    cycle: { claimed: true, jobId: "job-1", status: "succeeded", crawlRunId: "run-1", discoveredUrls: 1, fetchedUrls: 1, issues: 0 },
    discoveredUrls: 1,
    fetchResults: 1,
    indexabilityAssessments: 1,
    crawlRunCompleted: true,
    crawlRunSummaryPresent: true,
    healthScore: 100,
    ...overrides
  };
}

test("minimal 1-page site (no sitemap, no links) passes all criteria", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot());
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.criteria.length, 6);
  assert.equal(evaluation.criteria.every((criterion) => criterion.pass), true);
});

test("fails when the job did not succeed", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ cycle: { claimed: true, status: "failed", errorMessage: "boom" } }));
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.criteria.find((c) => c.name === "job_claimed_and_succeeded")?.pass, false);
});

test("fails when no job was claimed", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ cycle: { claimed: false } }));
  assert.equal(evaluation.criteria.find((c) => c.name === "job_claimed_and_succeeded")?.pass, false);
});

test("fails when nothing was discovered", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ discoveredUrls: 0 }));
  assert.equal(evaluation.criteria.find((c) => c.name === "discovered_urls")?.pass, false);
});

test("fails when nothing was fetched", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ fetchResults: 0, indexabilityAssessments: 0 }));
  assert.equal(evaluation.criteria.find((c) => c.name === "fetch_results")?.pass, false);
});

test("fails when fetched URLs lack indexability assessments", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ fetchResults: 3, indexabilityAssessments: 2 }));
  assert.equal(evaluation.criteria.find((c) => c.name === "indexability_assessed")?.pass, false);
});

test("fails when the crawl run has no summary", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ crawlRunSummaryPresent: false }));
  assert.equal(evaluation.criteria.find((c) => c.name === "crawl_run_completed_with_summary")?.pass, false);
});

test("fails when no health score was computed", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ healthScore: null }));
  assert.equal(evaluation.criteria.find((c) => c.name === "health_score_computed")?.pass, false);
});

test("a zero health score still counts as computed", () => {
  const evaluation = evaluateSmokeCriteria(baseSnapshot({ healthScore: 0 }));
  assert.equal(evaluation.criteria.find((c) => c.name === "health_score_computed")?.pass, true);
});
