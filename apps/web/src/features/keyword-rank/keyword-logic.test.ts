/**
 * Tests for keyword-logic — pure helpers for the Keywords & Rankings screen.
 * Vitest (globals enabled). No rendering, no API.
 */

import type { Keyword, RankSnapshot } from "@seo-tool/domain-model";
import {
  bucketsFromRows,
  buildKeywordRow,
  confidenceLevel,
  distinctMarkets,
  emptyBuckets,
  filterKeywordRows,
  intentLabel,
  matchesKeywordFilter,
  positionToBucket,
  sparklineSeries,
  type KeywordRow,
} from "./keyword-logic";

function makeKeyword(over: Partial<Keyword> = {}): Keyword {
  return {
    id: "kw-1",
    projectId: "p-1",
    groupId: null,
    phrase: "seo tool kaufen",
    normalizedPhrase: "seo tool kaufen",
    intent: "transactional",
    brand: false,
    funnelStage: "decision",
    market: "de-DE",
    targetUrl: null,
    source: "manual",
    sourceConfidence: "C",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function snap(capturedAt: string, position: number | null): RankSnapshot {
  return {
    id: `r-${capturedAt}`,
    projectId: "p-1",
    keywordId: "kw-1",
    serpSnapshotId: null,
    market: "de-DE",
    device: "desktop",
    position,
    url: null,
    capturedAt,
    sourceConfidence: "C",
  };
}

// ---------------------------------------------------------------------------
// positionToBucket
// ---------------------------------------------------------------------------

describe("positionToBucket()", () => {
  it("maps positions to the five tiers", () => {
    expect(positionToBucket(1)).toBe("top3");
    expect(positionToBucket(3)).toBe("top3");
    expect(positionToBucket(4)).toBe("top10");
    expect(positionToBucket(10)).toBe("top10");
    expect(positionToBucket(11)).toBe("strikingDist");
    expect(positionToBucket(20)).toBe("strikingDist");
    expect(positionToBucket(21)).toBe("mid");
    expect(positionToBucket(50)).toBe("mid");
    expect(positionToBucket(51)).toBe("weak");
    expect(positionToBucket(100)).toBe("weak");
  });

  it("returns null for out-of-range / invalid", () => {
    expect(positionToBucket(0)).toBeNull();
    expect(positionToBucket(101)).toBeNull();
    expect(positionToBucket(Number.NaN)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildKeywordRow
// ---------------------------------------------------------------------------

describe("buildKeywordRow()", () => {
  it("sorts history oldest→newest and computes current/previous/delta", () => {
    const row = buildKeywordRow(makeKeyword(), [
      snap("2026-01-03T00:00:00.000Z", 8),
      snap("2026-01-01T00:00:00.000Z", 12),
      snap("2026-01-02T00:00:00.000Z", 10),
    ]);
    expect(row.rankHistory.map((p) => p.position)).toEqual([12, 10, 8]);
    expect(row.currentPosition).toBe(8);
    expect(row.previousPosition).toBe(10);
    // improvement: 8 − 10 = −2 (negative is good for rankings)
    expect(row.positionDelta).toBe(-2);
  });

  it("handles empty history (no rank yet)", () => {
    const row = buildKeywordRow(makeKeyword(), []);
    expect(row.rankHistory).toEqual([]);
    expect(row.currentPosition).toBeNull();
    expect(row.previousPosition).toBeNull();
    expect(row.positionDelta).toBeNull();
  });

  it("ignores unranked (null position) points for current/previous", () => {
    const row = buildKeywordRow(makeKeyword(), [
      snap("2026-01-01T00:00:00.000Z", null),
      snap("2026-01-02T00:00:00.000Z", 5),
    ]);
    expect(row.currentPosition).toBe(5);
    expect(row.previousPosition).toBeNull();
    expect(row.positionDelta).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sparklineSeries
// ---------------------------------------------------------------------------

describe("sparklineSeries()", () => {
  it("inverts positions so a better rank renders higher", () => {
    const row = buildKeywordRow(makeKeyword(), [
      snap("2026-01-01T00:00:00.000Z", 10),
      snap("2026-01-02T00:00:00.000Z", 1),
    ]);
    // 101 − 10 = 91, 101 − 1 = 100 → improving trend rises
    expect(sparklineSeries(row)).toEqual([91, 100]);
  });

  it("is empty when there is no ranked history", () => {
    expect(sparklineSeries(buildKeywordRow(makeKeyword(), []))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filtering
// ---------------------------------------------------------------------------

describe("matchesKeywordFilter() / filterKeywordRows()", () => {
  const rows: KeywordRow[] = [
    buildKeywordRow(makeKeyword({ id: "a", intent: "transactional", brand: true, market: "de-DE" }), []),
    buildKeywordRow(makeKeyword({ id: "b", intent: "informational", brand: false, market: "de-DE" }), []),
    buildKeywordRow(makeKeyword({ id: "c", intent: "informational", brand: false, market: "en-US" }), []),
  ];

  it("passes everything with the default 'all' filter", () => {
    expect(filterKeywordRows(rows, {}).length).toBe(3);
    expect(filterKeywordRows(rows, { intent: "all", brand: "all", market: "all" }).length).toBe(3);
  });

  it("filters by intent", () => {
    expect(filterKeywordRows(rows, { intent: "informational" }).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("filters by brand / non-brand", () => {
    expect(filterKeywordRows(rows, { brand: "brand" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterKeywordRows(rows, { brand: "nonbrand" }).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("filters by market", () => {
    expect(filterKeywordRows(rows, { market: "en-US" }).map((r) => r.id)).toEqual(["c"]);
  });

  it("combines filters (AND)", () => {
    expect(
      matchesKeywordFilter(rows[2], { intent: "informational", brand: "nonbrand", market: "en-US" })
    ).toBe(true);
    expect(
      matchesKeywordFilter(rows[2], { intent: "informational", brand: "nonbrand", market: "de-DE" })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// distinctMarkets / bucketsFromRows
// ---------------------------------------------------------------------------

describe("distinctMarkets()", () => {
  it("returns sorted unique markets", () => {
    const rows = [
      buildKeywordRow(makeKeyword({ market: "de-DE" }), []),
      buildKeywordRow(makeKeyword({ market: "en-US" }), []),
      buildKeywordRow(makeKeyword({ market: "de-DE" }), []),
    ];
    expect(distinctMarkets(rows)).toEqual(["de-DE", "en-US"]);
  });
});

describe("bucketsFromRows()", () => {
  it("aggregates current positions into buckets", () => {
    const rows = [
      buildKeywordRow(makeKeyword({ id: "a" }), [snap("2026-01-01T00:00:00.000Z", 2)]),
      buildKeywordRow(makeKeyword({ id: "b" }), [snap("2026-01-01T00:00:00.000Z", 15)]),
      buildKeywordRow(makeKeyword({ id: "c" }), []), // unranked → ignored
    ];
    const buckets = bucketsFromRows(rows);
    expect(buckets.top3).toBe(1);
    expect(buckets.strikingDist).toBe(1);
    expect(buckets.total).toBe(2);
  });

  it("empty rows → empty buckets", () => {
    expect(bucketsFromRows([])).toEqual(emptyBuckets());
  });
});

// ---------------------------------------------------------------------------
// labels / confidence
// ---------------------------------------------------------------------------

describe("intentLabel() / confidenceLevel()", () => {
  it("labels intents in German", () => {
    expect(intentLabel("transactional")).toBe("Transaktional");
    expect(intentLabel("problem_solving")).toBe("Problemlösung");
  });

  it("normalises source confidence to A–E", () => {
    expect(confidenceLevel("a")).toBe("A");
    expect(confidenceLevel("E")).toBe("E");
    expect(confidenceLevel("x" as never)).toBe("E");
  });
});
