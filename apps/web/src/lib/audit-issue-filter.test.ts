import { describe, expect, it } from "vitest";
import { isDefaultIssueFilter, resolveIssueFilter } from "./audit-api";
import { issueFilterHref } from "../features/technical-audit/issue-filter-bar";

describe("resolveIssueFilter", () => {
  it("defaults to open / all / all", () => {
    expect(resolveIssueFilter()).toEqual({ status: "open", severity: "all", rule: "all" });
    expect(resolveIssueFilter({})).toEqual({ status: "open", severity: "all", rule: "all" });
  });

  it("accepts valid values", () => {
    expect(
      resolveIssueFilter({ issueStatus: "resolved", issueSeverity: "critical", issueRule: "http_error" })
    ).toEqual({
      status: "resolved",
      severity: "critical",
      rule: "http_error",
    });
    expect(resolveIssueFilter({ issueStatus: "all", issueSeverity: "low" })).toEqual({
      status: "all",
      severity: "low",
      rule: "all",
    });
  });

  it("parses a valid rule and falls back to all for an unknown rule", () => {
    expect(resolveIssueFilter({ issueRule: "broken_link" }).rule).toBe("broken_link");
    expect(resolveIssueFilter({ issueRule: "not_a_rule" }).rule).toBe("all");
  });

  it("falls back to defaults on invalid input", () => {
    expect(resolveIssueFilter({ issueStatus: "bogus", issueSeverity: "extreme", issueRule: "x" })).toEqual({
      status: "open",
      severity: "all",
      rule: "all",
    });
  });
});

describe("isDefaultIssueFilter", () => {
  it("is true only for open / all / all", () => {
    expect(isDefaultIssueFilter({ status: "open", severity: "all", rule: "all" })).toBe(true);
    expect(isDefaultIssueFilter({ status: "resolved", severity: "all", rule: "all" })).toBe(false);
    expect(isDefaultIssueFilter({ status: "open", severity: "high", rule: "all" })).toBe(false);
    expect(isDefaultIssueFilter({ status: "open", severity: "all", rule: "broken_link" })).toBe(false);
  });
});

describe("issueFilterHref", () => {
  it("omits default values from the query string", () => {
    expect(issueFilterHref({ status: "open", severity: "all", rule: "all" })).toBe("/technical-audit");
    expect(issueFilterHref({ status: "resolved", severity: "all", rule: "all" })).toBe(
      "/technical-audit?status=resolved"
    );
    expect(issueFilterHref({ status: "open", severity: "critical", rule: "all" })).toBe(
      "/technical-audit?severity=critical"
    );
    expect(issueFilterHref({ status: "all", severity: "high", rule: "all" })).toBe(
      "/technical-audit?status=all&severity=high"
    );
  });

  it("carries a non-default rule via issueRule (default-omitting)", () => {
    expect(issueFilterHref({ status: "open", severity: "all", rule: "broken_link" })).toBe(
      "/technical-audit?issueRule=broken_link"
    );
    const href = issueFilterHref({ status: "resolved", severity: "high", rule: "missing_title" });
    expect(href).toContain("status=resolved");
    expect(href).toContain("severity=high");
    expect(href).toContain("issueRule=missing_title");
  });
});
