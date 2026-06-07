/**
 * Tests for backlinks-logic — pure derivations & formatters (UX-4 §H DoD).
 * No rendering / no network: trend derivation, new/lost flow, follow-ratio,
 * snapshot deltas, formatters.
 */

import type {
  AuthoritySummary,
  BacklinkDiff,
  BacklinkSnapshot,
  ReferringDomain,
} from "@seo-tool/domain-model";
import {
  backlinkTrend,
  diffToFlowBars,
  followSplit,
  formatCount,
  formatRatioPct,
  formatSharePct,
  referringDomainTrend,
  snapshotDeltas,
  sortReferringDomains,
  sortSnapshotsAsc,
} from "./backlinks-logic";

function snap(partial: Partial<BacklinkSnapshot> & { id: string; capturedAt: string }): BacklinkSnapshot {
  return {
    projectId: "p1",
    totalBacklinks: 0,
    referringDomains: 0,
    sourceConfidence: "B",
    ...partial,
  };
}

function authority(partial: Partial<AuthoritySummary>): AuthoritySummary {
  return {
    totalBacklinks: 0,
    referringDomains: 0,
    followRatio: 0,
    topReferringDomains: [],
    topAnchors: [],
    topTargetUrls: [],
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// sortSnapshotsAsc / trends
// ---------------------------------------------------------------------------

describe("sortSnapshotsAsc()", () => {
  it("sorts oldest → newest and does not mutate input", () => {
    const input = [
      snap({ id: "b", capturedAt: "2026-02-01T00:00:00.000Z" }),
      snap({ id: "a", capturedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const sorted = sortSnapshotsAsc(input);
    expect(sorted.map((s) => s.id)).toEqual(["a", "b"]);
    expect(input.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("backlinkTrend() / referringDomainTrend()", () => {
  const snapshots = [
    snap({ id: "2", capturedAt: "2026-02-01T00:00:00.000Z", totalBacklinks: 120, referringDomains: 40 }),
    snap({ id: "1", capturedAt: "2026-01-01T00:00:00.000Z", totalBacklinks: 100, referringDomains: 30 }),
  ];

  it("returns ordered backlink trend values", () => {
    expect(backlinkTrend(snapshots).map((p) => p.value)).toEqual([100, 120]);
  });

  it("returns ordered referring-domain trend values", () => {
    expect(referringDomainTrend(snapshots).map((p) => p.value)).toEqual([30, 40]);
  });

  it("handles empty input", () => {
    expect(backlinkTrend([])).toEqual([]);
    expect(referringDomainTrend([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// diffToFlowBars
// ---------------------------------------------------------------------------

describe("diffToFlowBars()", () => {
  it("returns [] when diff is null", () => {
    expect(diffToFlowBars(null)).toEqual([]);
  });

  it("maps a diff into Backlinks + Domains bars", () => {
    const diff: BacklinkDiff = {
      newBacklinks: [{ sourceUrl: "a", sourceDomain: "a", targetUrl: "t", anchorText: "", linkType: "follow" }],
      lostBacklinks: [
        { sourceUrl: "b", sourceDomain: "b", targetUrl: "t", anchorText: "", linkType: "follow" },
        { sourceUrl: "c", sourceDomain: "c", targetUrl: "t", anchorText: "", linkType: "nofollow" },
      ],
      newReferringDomains: ["x.com"],
      lostReferringDomains: [],
      netBacklinkChange: -1,
      netReferringDomainChange: 1,
    };
    expect(diffToFlowBars(diff)).toEqual([
      { label: "Backlinks", gained: 1, lost: 2 },
      { label: "Verweisende Domains", gained: 1, lost: 0 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// followSplit
// ---------------------------------------------------------------------------

describe("followSplit()", () => {
  it("zeroes for null / empty authority", () => {
    expect(followSplit(null)).toEqual({ followCount: 0, nofollowCount: 0, followRatio: 0, followPct: 0, nofollowPct: 0 });
    expect(followSplit(authority({ totalBacklinks: 0, followRatio: 0.8 })).followCount).toBe(0);
  });

  it("splits totals by ratio and clamps ratio to 0–1", () => {
    const split = followSplit(authority({ totalBacklinks: 100, followRatio: 0.75 }));
    expect(split.followCount).toBe(75);
    expect(split.nofollowCount).toBe(25);
    expect(split.followPct).toBe(75);
    expect(split.nofollowPct).toBe(25);
  });

  it("clamps out-of-range ratios", () => {
    expect(followSplit(authority({ totalBacklinks: 10, followRatio: 1.5 })).followCount).toBe(10);
    expect(followSplit(authority({ totalBacklinks: 10, followRatio: -1 })).followCount).toBe(0);
  });

  it("follow + nofollow always equals total (rounding-safe)", () => {
    const split = followSplit(authority({ totalBacklinks: 7, followRatio: 0.5 }));
    expect(split.followCount + split.nofollowCount).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// snapshotDeltas
// ---------------------------------------------------------------------------

describe("snapshotDeltas()", () => {
  it("null deltas with fewer than two snapshots", () => {
    expect(snapshotDeltas([])).toEqual({ latest: null, previous: null, backlinkDelta: null, domainDelta: null });
    const single = snapshotDeltas([snap({ id: "1", capturedAt: "2026-01-01T00:00:00.000Z", totalBacklinks: 50 })]);
    expect(single.latest?.id).toBe("1");
    expect(single.previous).toBeNull();
    expect(single.backlinkDelta).toBeNull();
  });

  it("computes deltas from latest vs previous", () => {
    const d = snapshotDeltas([
      snap({ id: "1", capturedAt: "2026-01-01T00:00:00.000Z", totalBacklinks: 100, referringDomains: 30 }),
      snap({ id: "2", capturedAt: "2026-02-01T00:00:00.000Z", totalBacklinks: 130, referringDomains: 28 }),
    ]);
    expect(d.latest?.id).toBe("2");
    expect(d.previous?.id).toBe("1");
    expect(d.backlinkDelta).toBe(30);
    expect(d.domainDelta).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// sortReferringDomains
// ---------------------------------------------------------------------------

describe("sortReferringDomains()", () => {
  it("sorts by backlinks desc then domain asc, immutably", () => {
    const input: ReferringDomain[] = [
      { domain: "b.com", backlinks: 5, targetUrls: 1, followShare: 1, firstSeenAt: null, lastSeenAt: null },
      { domain: "a.com", backlinks: 5, targetUrls: 1, followShare: 1, firstSeenAt: null, lastSeenAt: null },
      { domain: "c.com", backlinks: 9, targetUrls: 2, followShare: 0.5, firstSeenAt: null, lastSeenAt: null },
    ];
    expect(sortReferringDomains(input).map((d) => d.domain)).toEqual(["c.com", "a.com", "b.com"]);
    expect(input[0].domain).toBe("b.com");
  });
});

// ---------------------------------------------------------------------------
// formatters
// ---------------------------------------------------------------------------

describe("formatters", () => {
  it("formatCount handles nullish and NaN", () => {
    expect(formatCount(null)).toBe("—");
    expect(formatCount(undefined)).toBe("—");
    expect(formatCount(Number.NaN)).toBe("—");
    expect(formatCount(1234)).toBe((1234).toLocaleString("de-DE"));
  });

  it("formatRatioPct formats and clamps", () => {
    expect(formatRatioPct(null)).toBe("—");
    expect(formatRatioPct(0.5)).toContain("50");
    expect(formatRatioPct(2)).toContain("100");
  });

  it("formatSharePct formats shares", () => {
    expect(formatSharePct(null)).toBe("—");
    expect(formatSharePct(0.25)).toContain("25");
  });
});
