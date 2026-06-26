import { beforeAll, describe, expect, it } from "vitest";
import { encryptJson } from "@seo-tool/api";
import { hostOf, matchGscProperty, verifyOAuthState, OAUTH_STATE_TTL_MS, type GscPropertyEntry } from "./oauth-google";

beforeAll(() => {
  process.env.OAUTH_ENCRYPTION_KEY = "web-oauth-test-key";
});

describe("verifyOAuthState", () => {
  it("accepts a fresh, well-formed state", () => {
    const now = 1_000_000;
    const state = encryptJson({ projectId: "proj-x", provider: "gsc", ts: now });
    expect(verifyOAuthState(state, now)).toEqual({ projectId: "proj-x", provider: "gsc", ts: now });
  });

  it("rejects an expired state", () => {
    const issued = 1_000_000;
    const state = encryptJson({ projectId: "proj-x", provider: "gsc", ts: issued });
    expect(verifyOAuthState(state, issued + OAUTH_STATE_TTL_MS + 1)).toBeNull();
  });

  it("rejects a tampered or unpar. able state", () => {
    expect(verifyOAuthState("not-a-valid-blob")).toBeNull();
    expect(verifyOAuthState(null)).toBeNull();
  });
});

describe("matchGscProperty", () => {
  const sites: GscPropertyEntry[] = [
    { siteUrl: "https://example.com/", permissionLevel: "siteOwner" },
    { siteUrl: "sc-domain:example.com", permissionLevel: "siteFullUser" },
    { siteUrl: "https://unverified.com/", permissionLevel: "siteUnverifiedUser" },
  ];

  it("prefers a sc-domain property for the host", () => {
    expect(matchGscProperty(sites, "example.com")).toBe("sc-domain:example.com");
  });

  it("falls back to a URL-prefix property when no domain property exists", () => {
    const only = [{ siteUrl: "https://shop.example.com/", permissionLevel: "siteOwner" }];
    expect(matchGscProperty(only, "shop.example.com")).toBe("https://shop.example.com/");
  });

  it("ignores unverified properties and returns null when nothing matches", () => {
    expect(matchGscProperty(sites, "unverified.com")).toBeNull();
    expect(matchGscProperty(sites, "other.com")).toBeNull();
    expect(matchGscProperty(sites, null)).toBeNull();
  });
});

describe("hostOf", () => {
  it("extracts a lowercased host or null", () => {
    expect(hostOf("https://Example.com/path")).toBe("example.com");
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
});
