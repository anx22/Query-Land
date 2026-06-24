import {
  aggregateGsc,
  canonicalizeUrl,
  latestRankSnapshot,
  rankPositionTrend,
  urlsMatch
} from "./dossier-api";
import type { RankSnapshot, SearchPerformanceRow } from "@seo-tool/domain-model";

function gscRow(over: Partial<SearchPerformanceRow>): SearchPerformanceRow {
  return {
    id: "r",
    projectId: "p",
    siteId: "s",
    query: "q",
    pageUrl: "https://example.com/a",
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
    market: "de",
    capturedAt: "2026-01-01T00:00:00.000Z",
    sourceConfidence: "B",
    ...over
  };
}

function rankSnap(over: Partial<RankSnapshot>): RankSnapshot {
  return {
    id: "rs",
    projectId: "p",
    keywordId: "k",
    serpSnapshotId: null,
    market: "de",
    device: "desktop",
    position: null,
    url: null,
    capturedAt: "2026-01-01T00:00:00.000Z",
    sourceConfidence: "C",
    ...over
  };
}

describe("canonicalizeUrl()", () => {
  it("lowercases and drops a single trailing slash", () => {
    expect(canonicalizeUrl("https://Example.com/Path/")).toBe("https://example.com/path");
  });
  it("treats trailing-slash and non-slash hosts as equal", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe(canonicalizeUrl("https://example.com"));
  });
  it("returns empty for empty", () => {
    expect(canonicalizeUrl("")).toBe("");
  });
});

describe("urlsMatch()", () => {
  it("matches tolerant of trailing slash + case", () => {
    expect(urlsMatch("https://Example.com/a/", "https://example.com/a")).toBe(true);
  });
  it("does not match different paths", () => {
    expect(urlsMatch("https://example.com/a", "https://example.com/b")).toBe(false);
  });
  it("returns false for null/undefined", () => {
    expect(urlsMatch(null, "https://example.com/a")).toBe(false);
    expect(urlsMatch("https://example.com/a", undefined)).toBe(false);
  });
});

describe("aggregateGsc()", () => {
  it("returns null when no rows match the URL", () => {
    const rows = [gscRow({ pageUrl: "https://example.com/other" })];
    expect(aggregateGsc(rows, "https://example.com/a")).toBeNull();
  });

  it("sums clicks/impressions and weights position + ctr by impressions", () => {
    const rows = [
      gscRow({ clicks: 10, impressions: 100, position: 5, capturedAt: "2026-01-01T00:00:00Z" }),
      gscRow({ clicks: 30, impressions: 300, position: 9, capturedAt: "2026-01-02T00:00:00Z" })
    ];
    const out = aggregateGsc(rows, "https://example.com/a");
    expect(out).not.toBeNull();
    expect(out!.clicks).toBe(40);
    expect(out!.impressions).toBe(400);
    expect(out!.rowCount).toBe(2);
    // weighted position = (5*100 + 9*300) / 400 = 8
    expect(out!.position).toBe(8);
    // ctr = 40/400 = 0.1
    expect(out!.ctr).toBeCloseTo(0.1, 5);
  });

  it("orders trend series oldest → newest", () => {
    const rows = [
      gscRow({ clicks: 2, impressions: 20, position: 4, capturedAt: "2026-01-03T00:00:00Z" }),
      gscRow({ clicks: 1, impressions: 10, position: 6, capturedAt: "2026-01-01T00:00:00Z" })
    ];
    const out = aggregateGsc(rows, "https://example.com/a");
    expect(out!.clicksTrend).toEqual([1, 2]);
    expect(out!.positionTrend).toEqual([6, 4]);
  });
});

describe("rankPositionTrend()", () => {
  it("orders by capturedAt and drops null positions", () => {
    const snaps = [
      rankSnap({ position: 3, capturedAt: "2026-01-02T00:00:00Z" }),
      rankSnap({ position: null, capturedAt: "2026-01-03T00:00:00Z" }),
      rankSnap({ position: 7, capturedAt: "2026-01-01T00:00:00Z" })
    ];
    expect(rankPositionTrend(snaps)).toEqual([7, 3]);
  });
  it("returns empty for no snapshots", () => {
    expect(rankPositionTrend([])).toEqual([]);
  });
});

describe("latestRankSnapshot()", () => {
  it("returns the most recent by capturedAt", () => {
    const snaps = [
      rankSnap({ id: "old", capturedAt: "2026-01-01T00:00:00Z" }),
      rankSnap({ id: "new", capturedAt: "2026-01-09T00:00:00Z" })
    ];
    expect(latestRankSnapshot(snaps)?.id).toBe("new");
  });
  it("returns null when empty", () => {
    expect(latestRankSnapshot([])).toBeNull();
  });
});
