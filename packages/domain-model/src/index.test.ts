import assert from "node:assert/strict";
import test from "node:test";
import { hasRequiredEvidence, scoreOpportunity, type Opportunity } from "./index.js";

test("scores impact, confidence, business value, urgency and effort", () => {
  assert.equal(
    scoreOpportunity({
      expectedImpact: 0.8,
      confidence: 0.9,
      businessValue: 0.7,
      urgency: 0.6,
      effort: 0.3
    }),
    101
  );
});

test("requires at least one class A-C evidence source", () => {
  const opportunity = {
    evidence: [{ sourceConfidence: "B" }]
  } as Pick<Opportunity, "evidence">;

  assert.equal(hasRequiredEvidence(opportunity), true);
});
