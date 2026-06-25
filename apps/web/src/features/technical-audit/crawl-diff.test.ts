import { describe, expect, it } from "vitest";
import {
  diffRuleLabel,
  diffSelectionHref,
  formatDelta,
  formatSigned,
  hasCompleteSelection,
  resolveDiffSelection,
  runOptionLabel,
  severityBadgeTone,
  severityLabel,
} from "./crawl-diff";

// --- formatSigned ---

describe("formatSigned", () => {
  it("prefixes positive values with +", () => {
    expect(formatSigned(3)).toBe("+3");
  });
  it("uses a real minus sign for negatives", () => {
    expect(formatSigned(-2)).toBe("−2");
  });
  it("renders zero without a sign", () => {
    expect(formatSigned(0)).toBe("0");
  });
});

// --- formatDelta (sign + tone, null-safe) ---

describe("formatDelta", () => {
  it("renders null/undefined/NaN as em-dash + neutral", () => {
    expect(formatDelta(null)).toEqual({ text: "—", tone: "neutral" });
    expect(formatDelta(undefined)).toEqual({ text: "—", tone: "neutral" });
    expect(formatDelta(Number.NaN)).toEqual({ text: "—", tone: "neutral" });
  });

  it("zero is always neutral regardless of direction", () => {
    expect(formatDelta(0, "higherIsBetter")).toEqual({ text: "0", tone: "neutral" });
    expect(formatDelta(0, "higherIsWorse")).toEqual({ text: "0", tone: "neutral" });
  });

  it("higherIsBetter: rise is positive, drop is negative (health score)", () => {
    expect(formatDelta(5, "higherIsBetter")).toEqual({ text: "+5", tone: "positive" });
    expect(formatDelta(-5, "higherIsBetter")).toEqual({ text: "−5", tone: "negative" });
  });

  it("higherIsWorse: rise is negative, drop is positive (open issues)", () => {
    expect(formatDelta(4, "higherIsWorse")).toEqual({ text: "+4", tone: "negative" });
    expect(formatDelta(-4, "higherIsWorse")).toEqual({ text: "−4", tone: "positive" });
  });

  it("none: any non-zero is neutral (discovered URLs)", () => {
    expect(formatDelta(7, "none")).toEqual({ text: "+7", tone: "neutral" });
    expect(formatDelta(-7, "none")).toEqual({ text: "−7", tone: "neutral" });
    expect(formatDelta(7)).toEqual({ text: "+7", tone: "neutral" });
  });

  it("rounds to two decimals", () => {
    expect(formatDelta(1.005, "higherIsBetter").text).toBe("+1");
    expect(formatDelta(-2.5, "higherIsBetter")).toEqual({ text: "−2,5", tone: "negative" });
  });
});

// --- labels ---

describe("severityLabel / severityBadgeTone", () => {
  it("maps severities to German labels", () => {
    expect(severityLabel("critical")).toBe("Kritisch");
    expect(severityLabel("high")).toBe("Hoch");
    expect(severityLabel("medium")).toBe("Mittel");
    expect(severityLabel("low")).toBe("Niedrig");
  });
  it("maps severities to functional badge tones", () => {
    expect(severityBadgeTone("critical")).toBe("danger");
    expect(severityBadgeTone("high")).toBe("warning");
    expect(severityBadgeTone("medium")).toBe("primary");
    expect(severityBadgeTone("low")).toBe("");
  });
});

describe("diffRuleLabel", () => {
  it("maps rules to German labels", () => {
    expect(diffRuleLabel("http_error")).toBe("HTTP-Fehler");
    expect(diffRuleLabel("canonical_mismatch")).toBe("Canonical-Abweichung");
    expect(diffRuleLabel("broken_link")).toBe("Defekter Link");
  });
});

// --- selection resolution ---

describe("resolveDiffSelection", () => {
  const ids = ["r1", "r2", "r3"];

  it("returns nulls when nothing selected", () => {
    expect(resolveDiffSelection({}, ids)).toEqual({ base: null, compare: null });
  });

  it("keeps known ids", () => {
    expect(resolveDiffSelection({ diffBase: "r1", diffCompare: "r2" }, ids)).toEqual({
      base: "r1",
      compare: "r2",
    });
  });

  it("drops unknown ids (stale links)", () => {
    expect(resolveDiffSelection({ diffBase: "gone", diffCompare: "r2" }, ids)).toEqual({
      base: null,
      compare: "r2",
    });
  });

  it("clears compare when it equals base (no self-diff)", () => {
    expect(resolveDiffSelection({ diffBase: "r1", diffCompare: "r1" }, ids)).toEqual({
      base: "r1",
      compare: null,
    });
  });
});

describe("hasCompleteSelection", () => {
  it("true only when both sides are present", () => {
    expect(hasCompleteSelection({ base: "a", compare: "b" })).toBe(true);
    expect(hasCompleteSelection({ base: "a", compare: null })).toBe(false);
    expect(hasCompleteSelection({ base: null, compare: "b" })).toBe(false);
    expect(hasCompleteSelection({ base: null, compare: null })).toBe(false);
  });
});

// --- href building ---

describe("diffSelectionHref", () => {
  it("omits the param when value is null and drops other defaults", () => {
    expect(diffSelectionHref({}, "diffBase", null)).toBe("/technical-audit");
  });
  it("sets the chosen param", () => {
    expect(diffSelectionHref({}, "diffBase", "r1")).toBe("/technical-audit?diffBase=r1");
  });
  it("preserves other params while overriding the target one", () => {
    const href = diffSelectionHref(
      { status: "open", diffBase: "old", diffCompare: "r2" },
      "diffBase",
      "r1"
    );
    expect(href).toContain("status=open");
    expect(href).toContain("diffCompare=r2");
    expect(href).toContain("diffBase=r1");
    expect(href).not.toContain("diffBase=old");
  });
});

describe("runOptionLabel", () => {
  it("combines a formatted timestamp with the trigger", () => {
    const label = runOptionLabel({ startedAt: "2026-06-01T10:00:00.000Z", trigger: "manual" });
    expect(label).toContain("·");
    expect(label).toContain("manual");
  });
});
