import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@seo-tool/api", () => ({ createGscClient: vi.fn() }));
vi.mock("../../../../../lib/server-api", () => ({ callInternalApi: vi.fn() }));
vi.mock("../../../../../lib/oauth-google", () => ({
  verifyOAuthState: vi.fn(),
  hostOf: vi.fn(),
  matchGscProperty: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";
import { createGscClient } from "@seo-tool/api";
import { callInternalApi } from "../../../../../lib/server-api";
import { hostOf, matchGscProperty, verifyOAuthState } from "../../../../../lib/oauth-google";

function req(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/oauth/google/callback${query}`);
}

function locationOf(res: Response): string {
  return res.headers.get("location") ?? "";
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost/api/oauth/google/callback");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/oauth/google/callback", () => {
  it("redirects to /settings with an error when the CSRF state is invalid", async () => {
    vi.mocked(verifyOAuthState).mockReturnValue(null);
    const res = await GET(req("?code=abc&state=tampered"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toContain("/settings?error=");
    // No credential write on the failure path.
    expect(callInternalApi).not.toHaveBeenCalled();
  });

  it("redirects with an error when Google returns no refresh token", async () => {
    vi.mocked(verifyOAuthState).mockReturnValue({ projectId: "p1" } as never);
    vi.mocked(createGscClient).mockReturnValue({
      exchangeCodeForTokens: vi.fn(async () => ({ accessToken: "at", refreshToken: null, expiresAt: 1 })),
      listSites: vi.fn(async () => []),
    } as never);
    const res = await GET(req("?code=abc&state=ok"));
    expect(res.status).toBe(307);
    // Query values use form-encoding (spaces as "+"), so normalize before decoding.
    expect(decodeURIComponent(locationOf(res).replace(/\+/g, " "))).toContain("Kein dauerhafter Zugriff");
  });

  it("exchanges the code and stores credentials on the happy path", async () => {
    vi.mocked(verifyOAuthState).mockReturnValue({ projectId: "p1" } as never);
    vi.mocked(createGscClient).mockReturnValue({
      exchangeCodeForTokens: vi.fn(async () => ({ accessToken: "at", refreshToken: "rt", expiresAt: 123 })),
      listSites: vi.fn(async () => [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }]),
    } as never);
    vi.mocked(callInternalApi)
      .mockResolvedValueOnce({ status: 200, body: { data: [{ baseUrl: "https://example.com" }] } } as never) // GET sites
      .mockResolvedValueOnce({ status: 200, body: { data: {} } } as never); // POST credentials
    vi.mocked(hostOf).mockReturnValue("example.com");
    vi.mocked(matchGscProperty).mockReturnValue("sc-domain:example.com");

    const res = await GET(req("?code=abc&state=ok"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toContain("connected=gsc");
    // Credentials were persisted via the internal API (never logged).
    expect(callInternalApi).toHaveBeenCalledWith("POST", "/integrations/credentials", expect.objectContaining({
      projectId: "p1",
      provider: "gsc",
      property: "sc-domain:example.com",
    }));
  });
});
