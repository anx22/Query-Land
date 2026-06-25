import { describe, it, expect } from "vitest";
import {
  addInternalLink,
  availableTransitions,
  briefStatusLabel,
  intentLabel,
  isBriefEditable,
  parseInternalLinks,
  parseLines,
  parseTerms,
  resolveBriefStatusFilter,
  resolveIntent,
  resolveWorkspaceBanner,
  scoreBand,
  scoreBandLabel,
  serializeInternalLinks,
  serializeLines,
  serializeTerms,
  validateBriefDraft,
} from "./brief-form";

describe("resolveBriefStatusFilter", () => {
  it("accepts valid statuses and the all-filter", () => {
    expect(resolveBriefStatusFilter("draft")).toBe("draft");
    expect(resolveBriefStatusFilter("done")).toBe("done");
    expect(resolveBriefStatusFilter("all")).toBe("all");
  });
  it("defaults to all for unknown/empty input", () => {
    expect(resolveBriefStatusFilter(undefined)).toBe("all");
    expect(resolveBriefStatusFilter("nope")).toBe("all");
  });
  it("labels statuses in German", () => {
    expect(briefStatusLabel("all")).toBe("Alle");
    expect(briefStatusLabel("in_progress")).toBe("In Arbeit");
  });
});

describe("availableTransitions / isBriefEditable", () => {
  it("offers the forward step plus dismiss for non-terminal states", () => {
    expect(availableTransitions("draft")).toEqual(["ready", "dismissed"]);
    expect(availableTransitions("ready")).toEqual(["in_progress", "dismissed"]);
    expect(availableTransitions("in_progress")).toEqual(["done", "dismissed"]);
  });
  it("offers reopen to draft from terminal states", () => {
    expect(availableTransitions("done")).toEqual(["draft"]);
    expect(availableTransitions("dismissed")).toEqual(["draft"]);
  });
  it("marks terminal states as non-editable", () => {
    expect(isBriefEditable("draft")).toBe(true);
    expect(isBriefEditable("in_progress")).toBe(true);
    expect(isBriefEditable("done")).toBe(false);
    expect(isBriefEditable("dismissed")).toBe(false);
  });
});

describe("parseLines / serializeLines", () => {
  it("splits, trims and drops empty lines", () => {
    expect(parseLines("a\n  b \n\n c\n")).toEqual(["a", "b", "c"]);
    expect(parseLines("")).toEqual([]);
    expect(parseLines(null)).toEqual([]);
  });
  it("round-trips", () => {
    expect(serializeLines(["a", "b"])).toBe("a\nb");
    expect(parseLines(serializeLines(["x", "y"]))).toEqual(["x", "y"]);
  });
});

describe("parseTerms / serializeTerms", () => {
  it("reads the [x] done marker and plain terms", () => {
    expect(parseTerms("[x] alpha\n[ ] beta\ngamma")).toEqual([
      { term: "alpha", done: true },
      { term: "beta", done: false },
      { term: "gamma", done: false },
    ]);
  });
  it("de-duplicates case-insensitively keeping the first", () => {
    expect(parseTerms("[x] Foo\nfoo")).toEqual([{ term: "Foo", done: true }]);
  });
  it("round-trips through serialize", () => {
    const terms = [
      { term: "alpha", done: true },
      { term: "beta", done: false },
    ];
    expect(parseTerms(serializeTerms(terms))).toEqual(terms);
  });
});

describe("parseInternalLinks / serializeInternalLinks", () => {
  it("parses url | anchor | reason with optional fields", () => {
    expect(parseInternalLinks("/a | Anchor | weil\n/b")).toEqual([
      { url: "/a", anchor: "Anchor", reason: "weil" },
      { url: "/b", anchor: null, reason: "manuell hinzugefügt" },
    ]);
  });
  it("skips lines without a url", () => {
    expect(parseInternalLinks(" | only anchor")).toEqual([]);
  });
  it("round-trips", () => {
    const links = [{ url: "/a", anchor: "x", reason: "r" }];
    expect(parseInternalLinks(serializeInternalLinks(links))).toEqual(links);
  });
});

describe("addInternalLink", () => {
  const base = [{ url: "/a", anchor: null, reason: "r" }];
  it("appends a new link", () => {
    const next = addInternalLink(base, { url: "/b", anchor: "B", reason: "r2" });
    expect(next).toHaveLength(2);
    expect(next[1].url).toBe("/b");
  });
  it("does not duplicate by url", () => {
    const next = addInternalLink(base, { url: "/a", anchor: "other", reason: "x" });
    expect(next).toHaveLength(1);
  });
  it("does not mutate the input", () => {
    addInternalLink(base, { url: "/b", anchor: null, reason: "r" });
    expect(base).toHaveLength(1);
  });
});

describe("intent helpers", () => {
  it("labels and coerces intents", () => {
    expect(intentLabel("commercial")).toBe("Kommerziell");
    expect(resolveIntent("transactional")).toBe("transactional");
    expect(resolveIntent("bogus")).toBe("informational");
    expect(resolveIntent(null)).toBe("informational");
  });
});

describe("validateBriefDraft", () => {
  it("passes a complete draft", () => {
    expect(
      validateBriefDraft({ url: "/x", title: "T", targetTopic: "topic", intent: "informational" })
    ).toEqual({ ok: true, errors: [] });
  });
  it("collects all missing-field errors", () => {
    const result = validateBriefDraft({
      url: "  ",
      title: "",
      targetTopic: "",
      intent: "informational",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
  it("rejects an invalid intent", () => {
    const result = validateBriefDraft({
      url: "/x",
      title: "T",
      targetTopic: "",
      intent: "weird" as never,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Intent"))).toBe(true);
  });
});

describe("resolveWorkspaceBanner", () => {
  it("returns null with no params", () => {
    expect(resolveWorkspaceBanner()).toBeNull();
    expect(resolveWorkspaceBanner({ saved: "unknown" })).toBeNull();
  });
  it("maps a known saved key to a success banner", () => {
    const banner = resolveWorkspaceBanner({ saved: "created" });
    expect(banner?.tone).toBe("success");
    expect(banner?.message).toContain("erstellt");
  });
  it("prefers an error over a saved flag", () => {
    const banner = resolveWorkspaceBanner({ error: "Boom", saved: "created" });
    expect(banner?.tone).toBe("danger");
    expect(banner?.message).toBe("Boom");
    expect(banner?.role).toBe("alert");
  });
});

describe("scoreBand / scoreBandLabel", () => {
  it("classifies by gauge thresholds", () => {
    expect(scoreBand(85)).toBe("good");
    expect(scoreBand(70)).toBe("good");
    expect(scoreBand(55)).toBe("warn");
    expect(scoreBand(40)).toBe("warn");
    expect(scoreBand(10)).toBe("bad");
  });
  it("returns unknown for null/NaN", () => {
    expect(scoreBand(null)).toBe("unknown");
    expect(scoreBand(Number.NaN)).toBe("unknown");
    expect(scoreBandLabel(null)).toBe("kein Score");
  });
  it("labels each band", () => {
    expect(scoreBandLabel(90)).toBe("gut");
    expect(scoreBandLabel(50)).toBe("verbesserungswürdig");
    expect(scoreBandLabel(5)).toBe("kritisch");
  });
});
