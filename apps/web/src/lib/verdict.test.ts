import { describe, it, expect } from "vitest";
import { deriveAuditVerdict, deriveKeywordsVerdict, deriveOpportunitiesVerdict } from "./verdict";

describe("deriveAuditVerdict", () => {
  it("returns null when there is nothing to summarise", () => {
    expect(deriveAuditVerdict({ health: null, healthDelta: null, openIssues: 0, indexable: null })).toBeNull();
  });

  it("is good when health is high and there are no open issues", () => {
    const v = deriveAuditVerdict({ health: 92, healthDelta: null, openIssues: 0, indexable: 120 });
    expect(v).toEqual({ text: "Health 92/100 · keine offenen Issues · 120 indexierbare URLs", tone: "good" });
  });

  it("downgrades a high health to warn when issues are open", () => {
    const v = deriveAuditVerdict({ health: 90, healthDelta: null, openIssues: 5, indexable: null });
    expect(v?.tone).toBe("warn");
    expect(v?.text).toContain("5 offene Issues");
  });

  it("is bad when health is below 50", () => {
    expect(deriveAuditVerdict({ health: 40, healthDelta: null, openIssues: 3, indexable: null })?.tone).toBe("bad");
  });

  it("appends a health trend and downgrades good→warn on a fall", () => {
    const v = deriveAuditVerdict({ health: 85, healthDelta: -6, openIssues: 0, indexable: null });
    expect(v?.text).toContain("Health fällt (-6)");
    expect(v?.tone).toBe("warn");
  });

  it("shows a rising trend with a plus sign", () => {
    expect(deriveAuditVerdict({ health: 70, healthDelta: 4, openIssues: 1, indexable: null })?.text).toContain("Health steigt (+4)");
  });
});

describe("deriveOpportunitiesVerdict", () => {
  it("returns null with no opportunities", () => {
    expect(deriveOpportunitiesVerdict({ total: 0, active: 0, quickWins: 0, topPriority: null })).toBeNull();
  });

  it("is good and highlights quick wins + top priority", () => {
    const v = deriveOpportunitiesVerdict({ total: 34, active: 20, quickWins: 6, topPriority: 87 });
    expect(v).toEqual({ text: "34 Chancen · 20 aktiv · 6 Quick Wins zuerst — Top-Priorität 87", tone: "good" });
  });

  it("warns when there is active work but no quick wins", () => {
    expect(deriveOpportunitiesVerdict({ total: 5, active: 5, quickWins: 0, topPriority: null })?.tone).toBe("warn");
  });
});

describe("deriveKeywordsVerdict", () => {
  it("returns null with no keywords", () => {
    expect(deriveKeywordsVerdict({ visibility: null, visibilityDelta: null, avgPosition: null, totalKeywords: 0 })).toBeNull();
  });

  it("summarises visibility, avg position and set size", () => {
    const v = deriveKeywordsVerdict({ visibility: 72, visibilityDelta: null, avgPosition: 8, totalKeywords: 120 });
    expect(v).toEqual({ text: "Visibility 72/100 · Ø Position 8 · 120 Keywords", tone: "good" });
  });

  it("appends a falling trend and downgrades good→warn", () => {
    const v = deriveKeywordsVerdict({ visibility: 65, visibilityDelta: -3, avgPosition: null, totalKeywords: 40 });
    expect(v?.text).toContain("Sichtbarkeit fällt (-3)");
    expect(v?.tone).toBe("warn");
  });
});
