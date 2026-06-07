import { describe, it, expect } from "vitest";
import type { AuditIssueRecord, DiscoveredUrl } from "@seo-tool/domain-model";
import {
  deriveFunnelStages,
  firstPathSegment,
  groupUrlsByPath,
  sectionHealth,
  groupIssues,
} from "./audit-api";

// ---------------------------------------------------------------------------
// deriveFunnelStages
// ---------------------------------------------------------------------------

describe("deriveFunnelStages", () => {
  it("produces four stages in lifecycle order", () => {
    const stages = deriveFunnelStages({ discovered: 100, fetched: 80, indexable: 60 });
    expect(stages.map((s) => s.key)).toEqual(["discovered", "fetched", "indexable", "indexed"]);
  });

  it("computes negative drops between known stages", () => {
    const stages = deriveFunnelStages({ discovered: 100, fetched: 80, indexable: 60 });
    expect(stages[0].drop).toBeNull(); // first stage never has a drop
    expect(stages[1].drop).toBe(-20);
    expect(stages[2].drop).toBe(-20);
  });

  it("never reports a positive drop (growth) as a drop", () => {
    const stages = deriveFunnelStages({ discovered: 50, fetched: 80, indexable: 60 });
    expect(stages[1].drop).toBeNull();
  });

  it("leaves indexed null when not provided (needs GSC coverage)", () => {
    const stages = deriveFunnelStages({ discovered: 100, fetched: 80, indexable: 60 });
    const indexed = stages.find((s) => s.key === "indexed");
    expect(indexed?.value).toBeNull();
    expect(indexed?.drop).toBeNull();
  });

  it("normalizes invalid counts to null", () => {
    const stages = deriveFunnelStages({ discovered: -5, fetched: NaN, indexable: null });
    expect(stages.every((s) => s.value === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// firstPathSegment
// ---------------------------------------------------------------------------

describe("firstPathSegment", () => {
  it("extracts the first path segment of an absolute URL", () => {
    expect(firstPathSegment("https://example.com/blog/post-1")).toBe("/blog");
  });

  it("returns / for the homepage", () => {
    expect(firstPathSegment("https://example.com/")).toBe("/");
    expect(firstPathSegment("https://example.com")).toBe("/");
  });

  it("handles bare path strings", () => {
    expect(firstPathSegment("/products/widget")).toBe("/products");
    expect(firstPathSegment("products/widget")).toBe("/products");
  });
});

// ---------------------------------------------------------------------------
// sectionHealth
// ---------------------------------------------------------------------------

describe("sectionHealth", () => {
  it("is 100 with no issues", () => {
    expect(sectionHealth(10, 0)).toBe(100);
  });

  it("decreases with issue density", () => {
    expect(sectionHealth(10, 10)).toBe(60); // density 1 → 100 - 40
    expect(sectionHealth(10, 5)).toBe(80); // density 0.5 → 100 - 20
  });

  it("clamps to 0 for very dense issues", () => {
    expect(sectionHealth(2, 10)).toBe(0);
  });

  it("returns 100 for empty sections", () => {
    expect(sectionHealth(0, 5)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// groupUrlsByPath
// ---------------------------------------------------------------------------

function url(normalizedUrl: string): Pick<DiscoveredUrl, "normalizedUrl" | "url"> {
  return { normalizedUrl, url: normalizedUrl };
}

describe("groupUrlsByPath", () => {
  it("groups URLs by first path segment and attaches issue counts", () => {
    const urls = [
      url("https://x.com/blog/a"),
      url("https://x.com/blog/b"),
      url("https://x.com/shop/a"),
    ];
    const issues = [{ url: "https://x.com/blog/a" }] as Array<Pick<AuditIssueRecord, "url">>;
    const groups = groupUrlsByPath(urls, issues);

    const blog = groups.find((g) => g.path === "/blog");
    const shop = groups.find((g) => g.path === "/shop");
    expect(blog?.urlCount).toBe(2);
    expect(blog?.issueCount).toBe(1);
    expect(shop?.urlCount).toBe(1);
    expect(shop?.issueCount).toBe(0);
  });

  it("sorts the largest section first", () => {
    const urls = [
      url("https://x.com/a/1"),
      url("https://x.com/b/1"),
      url("https://x.com/b/2"),
    ];
    const groups = groupUrlsByPath(urls, []);
    expect(groups[0].path).toBe("/b");
  });

  it("returns an empty array for no URLs", () => {
    expect(groupUrlsByPath([], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// groupIssues
// ---------------------------------------------------------------------------

function issue(
  rule: AuditIssueRecord["rule"],
  severity: AuditIssueRecord["severity"],
  id: string
): AuditIssueRecord {
  return {
    id,
    url: `https://x.com/${id}`,
    rule,
    severity,
    message: "msg",
    projectId: "p",
    siteId: "s",
    discoveredUrlId: null,
    detectedAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
  };
}

describe("groupIssues", () => {
  it("groups by rule + severity with counts and impact", () => {
    const groups = groupIssues([
      issue("missing_title", "high", "1"),
      issue("missing_title", "high", "2"),
      issue("broken_link", "low", "3"),
    ]);
    const titleGroup = groups.find((g) => g.key === "missing_title::high");
    expect(titleGroup?.count).toBe(2);
    expect(titleGroup?.impact).toBe(20); // 2 × high(10)
  });

  it("sorts by impact descending", () => {
    const groups = groupIssues([
      issue("broken_link", "low", "1"), // impact 2
      issue("http_error", "critical", "2"), // impact 18
    ]);
    expect(groups[0].rule).toBe("http_error");
  });

  it("caps the sample issue list", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      issue("missing_title", "medium", String(i))
    );
    const groups = groupIssues(many, 3);
    expect(groups[0].count).toBe(10);
    expect(groups[0].issues).toHaveLength(3);
  });

  it("returns an empty array for no issues", () => {
    expect(groupIssues([])).toEqual([]);
  });
});
