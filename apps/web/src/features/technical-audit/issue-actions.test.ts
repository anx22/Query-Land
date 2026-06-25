import { describe, expect, it } from "vitest";
import type { AuditIssueHistoryEntry } from "@seo-tool/domain-model";
import {
  availableIssueActions,
  formatHistoryEntry,
  historyActionLabel,
  isIssueOpen,
  issueStatusLabel,
} from "./issue-actions";

describe("availableIssueActions", () => {
  it("offers resolve + dismiss for open issues", () => {
    expect(availableIssueActions({ resolvedAt: null })).toEqual(["resolve", "dismiss"]);
  });
  it("offers reopen for resolved issues", () => {
    expect(availableIssueActions({ resolvedAt: "2026-06-25T00:00:00.000Z" })).toEqual(["reopen"]);
  });
  it("offers reopen for dismissed issues (distinct from resolved)", () => {
    expect(availableIssueActions({ resolvedAt: null, dismissedAt: "2026-06-25T00:00:00.000Z" })).toEqual(["reopen"]);
  });
});

describe("isIssueOpen", () => {
  it("is open only when neither resolved nor dismissed", () => {
    expect(isIssueOpen({ resolvedAt: null })).toBe(true);
    expect(isIssueOpen({ resolvedAt: null, dismissedAt: null })).toBe(true);
    expect(isIssueOpen({ resolvedAt: "2026-06-25T00:00:00.000Z" })).toBe(false);
    expect(isIssueOpen({ resolvedAt: null, dismissedAt: "2026-06-25T00:00:00.000Z" })).toBe(false);
  });
});

describe("issueStatusLabel", () => {
  it("reflects open vs. resolved vs. dismissed", () => {
    expect(issueStatusLabel({ resolvedAt: null })).toBe("Offen");
    expect(issueStatusLabel({ resolvedAt: "2026-06-25T00:00:00.000Z" })).toBe("Gelöst");
    expect(issueStatusLabel({ resolvedAt: null, dismissedAt: "2026-06-25T00:00:00.000Z" })).toBe("Verworfen");
  });
});

describe("historyActionLabel", () => {
  it("maps each lifecycle action to a German label", () => {
    expect(historyActionLabel("resolve")).toBe("Gelöst");
    expect(historyActionLabel("dismiss")).toBe("Verworfen");
    expect(historyActionLabel("reopen")).toBe("Wieder geöffnet");
  });
});

describe("formatHistoryEntry", () => {
  const base: AuditIssueHistoryEntry = {
    id: "aih-1",
    projectId: "proj",
    siteId: "site",
    issueId: "issue",
    action: "dismiss",
    actor: "user-7",
    reason: "Falsch-positiv",
    createdAt: "2026-06-25T10:00:00.000Z",
  };

  it("includes action, actor, timestamp and reason", () => {
    const line = formatHistoryEntry(base);
    expect(line).toContain("Verworfen");
    expect(line).toContain("user-7");
    expect(line).toContain("Falsch-positiv");
    expect(line).toContain(new Date(base.createdAt).toLocaleString("de-DE"));
  });

  it("omits the reason segment when there is none", () => {
    const line = formatHistoryEntry({ ...base, action: "resolve", reason: null });
    expect(line).toContain("Gelöst");
    expect(line.endsWith("·  ")).toBe(false);
    expect(line).not.toContain("Falsch-positiv");
  });
});
