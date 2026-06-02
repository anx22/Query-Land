import { describe, expect, it } from "vitest";
import { appRoutes, demoOpportunities } from "./index";
import { hasRequiredEvidence } from "@seo/domain-model";

describe("foundation routing and fixtures", () => {
  it("matches the documented main navigation order", () => {
    expect(appRoutes.map((route) => route.label)).toEqual([
      "Overview",
      "Projects",
      "Technical Audit",
      "Keywords & Rank",
      "Content & Opportunities",
      "Backlinks",
      "Reports",
      "AI Visibility",
      "Settings",
    ]);
  });

  it("keeps demo opportunities evidence-first", () => {
    expect(demoOpportunities.every(hasRequiredEvidence)).toBe(true);
  });
});
