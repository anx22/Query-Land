import type { Opportunity } from "@seo-tool/domain-model";
import {
  confidenceToLevel,
  filterOpportunities,
  matchesFilter,
  opportunityTypeColorKey,
  opportunityTypeLabel,
  statusToColumn,
} from "./board-logic";

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "op-1",
    projectId: "proj-1",
    type: "low_hanging_keyword",
    affectedUrls: [],
    affectedKeywords: [],
    affectedClusters: [],
    evidence: [],
    currentState: "",
    recommendedAction: "",
    expectedImpact: 3,
    effort: 3,
    confidence: 0.8,
    businessValue: 3,
    urgency: 3,
    priority: 100,
    validationMetric: "",
    owner: "",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("confidenceToLevel", () => {
  it("maps the 0–1 float onto the A–E scale", () => {
    expect(confidenceToLevel(0.95)).toBe("A");
    expect(confidenceToLevel(0.9)).toBe("A");
    expect(confidenceToLevel(0.75)).toBe("B");
    expect(confidenceToLevel(0.5)).toBe("C");
    expect(confidenceToLevel(0.35)).toBe("D");
    expect(confidenceToLevel(0.1)).toBe("E");
  });

  it("falls back to E for non-finite input", () => {
    expect(confidenceToLevel(Number.NaN)).toBe("E");
    expect(confidenceToLevel(Number.POSITIVE_INFINITY)).toBe("E");
  });
});

describe("statusToColumn", () => {
  it("collapses granular statuses into the four board columns", () => {
    expect(statusToColumn("open")).toBe("open");
    expect(statusToColumn("planned")).toBe("open");
    expect(statusToColumn("reopened")).toBe("open");
    expect(statusToColumn("in_progress")).toBe("in_progress");
    expect(statusToColumn("implemented")).toBe("implemented");
    expect(statusToColumn("validated")).toBe("validated");
  });

  it("returns null for statuses that are not shown on the board", () => {
    expect(statusToColumn("dismissed")).toBeNull();
    expect(statusToColumn("expired")).toBeNull();
  });
});

describe("opportunity type metadata", () => {
  it("returns a German label per type", () => {
    expect(opportunityTypeLabel("technical_fix")).toBe("Technischer Fix");
    expect(opportunityTypeLabel("aeo")).toBe("AEO");
  });

  it("maps each type onto a chartTheme.categorical key", () => {
    expect(opportunityTypeColorKey("technical_fix")).toBe("technical");
    expect(opportunityTypeColorKey("low_hanging_keyword")).toBe("keyword");
    expect(opportunityTypeColorKey("cannibalization")).toBe("cannibal");
    expect(opportunityTypeColorKey("money_page")).toBe("money");
    expect(opportunityTypeColorKey("internal_link_gap")).toBe("link");
    expect(opportunityTypeColorKey("aeo")).toBe("aeo");
  });
});

describe("matchesFilter", () => {
  it("passes everything when the filter is empty / 'all'", () => {
    const op = makeOpportunity();
    expect(matchesFilter(op, {})).toBe(true);
    expect(matchesFilter(op, { type: "all", status: "all" })).toBe(true);
  });

  it("filters by type", () => {
    const op = makeOpportunity({ type: "money_page" });
    expect(matchesFilter(op, { type: "money_page" })).toBe(true);
    expect(matchesFilter(op, { type: "technical_fix" })).toBe(false);
  });

  it("filters by status", () => {
    const op = makeOpportunity({ status: "in_progress" });
    expect(matchesFilter(op, { status: "in_progress" })).toBe(true);
    expect(matchesFilter(op, { status: "validated" })).toBe(false);
  });

  it("applies an impact floor and an effort ceiling", () => {
    const op = makeOpportunity({ expectedImpact: 4, effort: 2 });
    expect(matchesFilter(op, { minImpact: 4 })).toBe(true);
    expect(matchesFilter(op, { minImpact: 5 })).toBe(false);
    expect(matchesFilter(op, { maxEffort: 2 })).toBe(true);
    expect(matchesFilter(op, { maxEffort: 1 })).toBe(false);
  });

  it("combines several predicates (AND semantics)", () => {
    const op = makeOpportunity({ type: "money_page", status: "open", expectedImpact: 5, effort: 1 });
    expect(matchesFilter(op, { type: "money_page", status: "open", minImpact: 4, maxEffort: 2 })).toBe(true);
    expect(matchesFilter(op, { type: "money_page", status: "open", minImpact: 4, maxEffort: 0 })).toBe(true);
    expect(matchesFilter(op, { type: "aeo", status: "open" })).toBe(false);
  });
});

describe("filterOpportunities", () => {
  it("returns only the matching subset", () => {
    const list = [
      makeOpportunity({ id: "a", type: "money_page" }),
      makeOpportunity({ id: "b", type: "technical_fix" }),
      makeOpportunity({ id: "c", type: "money_page", status: "validated" }),
    ];
    const result = filterOpportunities(list, { type: "money_page", status: "open" });
    expect(result.map((o) => o.id)).toEqual(["a"]);
  });

  it("does not mutate the source array", () => {
    const list = [makeOpportunity({ id: "a" })];
    const result = filterOpportunities(list, { type: "aeo" });
    expect(list).toHaveLength(1);
    expect(result).toHaveLength(0);
  });
});
