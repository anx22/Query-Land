import { describe, expect, it } from "vitest";
import { hasRequiredEvidence, scoreOpportunity, type Opportunity } from "./index";

describe("opportunity core", () => {
  it("scores impact, confidence, business value, urgency and effort", () => {
    expect(
      scoreOpportunity({
        expectedImpact: 0.8,
        confidence: 0.9,
        businessValue: 0.7,
        urgency: 0.6,
        effort: 0.3,
      }),
    ).toBe(101);
  });

  it("requires at least one class A-C evidence source", () => {
    const opportunity = {
      evidence: [{ sourceConfidence: "B" }],
    } as Pick<Opportunity, "evidence">;

    expect(hasRequiredEvidence(opportunity)).toBe(true);
  });
});
