import { describe, expect, it } from "vitest";
import { availableIssueActions, issueStatusLabel } from "./issue-actions";

describe("availableIssueActions", () => {
  it("offers resolve + dismiss for open issues", () => {
    expect(availableIssueActions({ resolvedAt: null })).toEqual(["resolve", "dismiss"]);
  });
  it("offers reopen for resolved issues", () => {
    expect(availableIssueActions({ resolvedAt: "2026-06-25T00:00:00.000Z" })).toEqual(["reopen"]);
  });
});

describe("issueStatusLabel", () => {
  it("reflects open vs. resolved", () => {
    expect(issueStatusLabel({ resolvedAt: null })).toBe("Offen");
    expect(issueStatusLabel({ resolvedAt: "2026-06-25T00:00:00.000Z" })).toBe("Gelöst");
  });
});
