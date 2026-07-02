import { describe, it, expect } from "vitest";
import { deriveAuditVerdict } from "./verdict";

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
