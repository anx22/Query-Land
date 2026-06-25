import { describe, expect, it } from "vitest";
import { isDefaultIssueFilter, resolveIssueFilter } from "./audit-api";
import { issueFilterHref } from "../features/technical-audit/issue-filter-bar";

describe("resolveIssueFilter", () => {
  it("defaults to open / all", () => {
    expect(resolveIssueFilter()).toEqual({ status: "open", severity: "all" });
    expect(resolveIssueFilter({})).toEqual({ status: "open", severity: "all" });
  });

  it("accepts valid values", () => {
    expect(resolveIssueFilter({ issueStatus: "resolved", issueSeverity: "critical" })).toEqual({
      status: "resolved",
      severity: "critical",
    });
    expect(resolveIssueFilter({ issueStatus: "all", issueSeverity: "low" })).toEqual({ status: "all", severity: "low" });
  });

  it("falls back to defaults on invalid input", () => {
    expect(resolveIssueFilter({ issueStatus: "bogus", issueSeverity: "extreme" })).toEqual({
      status: "open",
      severity: "all",
    });
  });
});

describe("isDefaultIssueFilter", () => {
  it("is true only for open / all", () => {
    expect(isDefaultIssueFilter({ status: "open", severity: "all" })).toBe(true);
    expect(isDefaultIssueFilter({ status: "resolved", severity: "all" })).toBe(false);
    expect(isDefaultIssueFilter({ status: "open", severity: "high" })).toBe(false);
  });
});

describe("issueFilterHref", () => {
  it("omits default values from the query string", () => {
    expect(issueFilterHref({ status: "open", severity: "all" })).toBe("/technical-audit");
    expect(issueFilterHref({ status: "resolved", severity: "all" })).toBe("/technical-audit?status=resolved");
    expect(issueFilterHref({ status: "open", severity: "critical" })).toBe("/technical-audit?severity=critical");
    expect(issueFilterHref({ status: "all", severity: "high" })).toBe("/technical-audit?status=all&severity=high");
  });
});
