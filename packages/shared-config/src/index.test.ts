import assert from "node:assert/strict";
import test from "node:test";
import { hasRequiredEvidence } from "@seo-tool/domain-model";
import { appRoutes, demoOpportunities } from "./index.js";

test("matches the documented main navigation order", () => {
  assert.deepEqual(appRoutes.map((route) => route.label), [
    "Overview",
    "Projects",
    "Technical Audit",
    "Keywords & Rank",
    "Content & Opportunities",
    "Backlinks",
    "Reports",
    "AI Visibility",
    "Settings"
  ]);
});

test("keeps demo opportunities evidence-first", () => {
  assert.equal(demoOpportunities.every(hasRequiredEvidence), true);
});
