import { describe, it, expect } from "vitest";
import { resolveActionBanner } from "./action-banner";

describe("resolveActionBanner", () => {
  it("returns null when no relevant params are present", () => {
    expect(resolveActionBanner()).toBeNull();
    expect(resolveActionBanner({})).toBeNull();
    expect(resolveActionBanner({ started: "0" })).toBeNull();
    expect(resolveActionBanner({ error: "   " })).toBeNull();
  });

  it("maps an error param to a danger/alert banner with the decoded message", () => {
    const banner = resolveActionBanner({ error: "Crawl konnte nicht gestartet werden" });
    expect(banner).toEqual({
      tone: "danger",
      role: "alert",
      message: "Crawl konnte nicht gestartet werden",
    });
  });

  it("maps started=1 to a success/status banner", () => {
    const banner = resolveActionBanner({ started: "1" });
    expect(banner?.tone).toBe("success");
    expect(banner?.role).toBe("status");
    expect(banner?.message).toContain("Crawl gestartet");
  });

  it("prefers an error over a started flag", () => {
    const banner = resolveActionBanner({ error: "Boom", started: "1" });
    expect(banner?.tone).toBe("danger");
    expect(banner?.message).toBe("Boom");
  });
});
