import assert from "node:assert/strict";
import test from "node:test";
import { computeContentScore, rankRefreshCandidates } from "../src/content.js";

test("computeContentScore is deterministic and bounded 0..100", () => {
  const stable = computeContentScore(90, 0, 0);
  assert.equal(stable.score, 90);
  assert.ok(stable.reasons.some((r) => r.includes("stable")));

  // Open issues subtract 5 each; declining trend lowers further.
  const declining = computeContentScore(80, 2, -20);
  // 80 - (2*5) + clamp(round(-20/2),-20,20) = 80 - 10 - 10 = 60
  assert.equal(declining.score, 60);
  assert.ok(declining.reasons.some((r) => r.includes("open issue")));
  assert.ok(declining.reasons.some((r) => r.includes("declining")));

  // Lower bound respected.
  assert.equal(computeContentScore(10, 50, -100).score, 0);
  // Upper bound respected (growth cannot push past 100).
  assert.equal(computeContentScore(100, 0, 200).score, 100);

  // Same inputs -> same outputs.
  assert.deepEqual(computeContentScore(75, 1, -8), computeContentScore(75, 1, -8));
});

test("rankRefreshCandidates only includes declining pages, ranked deterministically", () => {
  const ranked = rankRefreshCandidates([
    { url: "https://x/steep", clicksTrend: -510, latestClicks: 310, openIssues: 1 },
    { url: "https://x/mild", clicksTrend: -60, latestClicks: 140, openIssues: 0 },
    { url: "https://x/growing", clicksTrend: 50, latestClicks: 450, openIssues: 0 },
    { url: "https://x/flat", clicksTrend: 0, latestClicks: 100, openIssues: 5 }
  ]);

  // Growing and flat pages are NOT refresh candidates.
  assert.deepEqual(ranked.map((c) => c.url), ["https://x/steep", "https://x/mild"]);
  // Steeper decline outranks mild decline.
  assert.ok(ranked[0].refreshScore > ranked[1].refreshScore);
  assert.ok(ranked[0].reasons.some((r) => r.includes("declined")));
});

test("rankRefreshCandidates tie-breaks by url and honors limit", () => {
  const ranked = rankRefreshCandidates(
    [
      { url: "https://x/b", clicksTrend: -100, latestClicks: 100, openIssues: 0 },
      { url: "https://x/a", clicksTrend: -100, latestClicks: 100, openIssues: 0 }
    ],
    { limit: 1 }
  );
  assert.equal(ranked.length, 1);
  // Equal scores -> alphabetical url wins.
  assert.equal(ranked[0].url, "https://x/a");
});
