import assert from "node:assert/strict";
import test from "node:test";
import {
  countryFilterForMarket,
  createGscClient,
  GscApiError,
  mapAveragePosition,
  mapSearchAnalyticsRows,
  type FetchImpl,
} from "../src/oauth/gsc-client.js";

type Call = { url: string; init?: RequestInit };

function mockFetch(handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): { fetchImpl: FetchImpl; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const { status = 200, body } = handler(url, init);
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
  }) as unknown as FetchImpl;
  return { fetchImpl, calls };
}

test("exchangeCodeForTokens posts the auth code and parses tokens", async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { access_token: "at", refresh_token: "rt", expires_in: 3600 } }));
  const client = createGscClient({ clientId: "cid", clientSecret: "sec", fetchImpl });
  const tokens = await client.exchangeCodeForTokens("the-code", "https://app/callback");
  assert.equal(tokens.accessToken, "at");
  assert.equal(tokens.refreshToken, "rt");
  assert.ok(Date.parse(tokens.expiresAt) > Date.now());
  assert.match(calls[0].url, /oauth2\.googleapis\.com\/token/);
  const body = String(calls[0].init?.body);
  assert.match(body, /grant_type=authorization_code/);
  assert.match(body, /code=the-code/);
  assert.match(body, /client_secret=sec/);
});

test("refreshAccessToken uses grant_type=refresh_token", async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { access_token: "at2", expires_in: 3600 } }));
  const client = createGscClient({ clientId: "cid", clientSecret: "sec", fetchImpl });
  const tokens = await client.refreshAccessToken("rt");
  assert.equal(tokens.accessToken, "at2");
  assert.equal(tokens.refreshToken, undefined, "Google may omit a new refresh token");
  assert.match(String(calls[0].init?.body), /grant_type=refresh_token/);
});

test("listSites returns verified property entries", async () => {
  const { fetchImpl } = mockFetch(() => ({ body: { siteEntry: [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }] } }));
  const client = createGscClient({ clientId: "c", clientSecret: "s", fetchImpl });
  const sites = await client.listSites("at");
  assert.equal(sites.length, 1);
  assert.equal(sites[0].siteUrl, "sc-domain:example.com");
});

test("querySearchAnalytics sends the property + bearer and returns rows", async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { rows: [{ keys: ["kw", "https://x/a"], clicks: 5, impressions: 100, ctr: 0.05, position: 12.3 }] } }));
  const client = createGscClient({ clientId: "c", clientSecret: "s", fetchImpl });
  const rows = await client.querySearchAnalytics("at", "sc-domain:example.com", { startDate: "2026-01-01", endDate: "2026-01-28", dimensions: ["query", "page"] });
  assert.equal(rows.length, 1);
  assert.match(calls[0].url, /sites\/sc-domain%3Aexample\.com\/searchAnalytics\/query/);
  assert.equal((calls[0].init?.headers as Record<string, string>).authorization, "Bearer at");
});

test("non-2xx responses raise a typed GscApiError flagged as auth when 401/403", async () => {
  const { fetchImpl } = mockFetch(() => ({ status: 403, body: { error: "forbidden" } }));
  const client = createGscClient({ clientId: "c", clientSecret: "s", fetchImpl });
  await assert.rejects(
    () => client.listSites("at"),
    (err: unknown) => err instanceof GscApiError && err.isAuthError && err.status === 403,
  );
});

test("invalid_grant on token refresh is an auth error", async () => {
  const { fetchImpl } = mockFetch(() => ({ status: 400, body: { error: "invalid_grant" } }));
  const client = createGscClient({ clientId: "c", clientSecret: "s", fetchImpl });
  await assert.rejects(
    () => client.refreshAccessToken("rt"),
    (err: unknown) => err instanceof GscApiError && err.isAuthError && err.code === "invalid_grant",
  );
});

test("mapSearchAnalyticsRows maps query+page keys", () => {
  const rows = mapSearchAnalyticsRows([
    { keys: ["seo tool", "https://x/pricing"], clicks: 10, impressions: 200, ctr: 0.05, position: 8.1 },
    { keys: ["incomplete"], clicks: 1, impressions: 2, ctr: 0.5, position: 1 }, // dropped (needs 2 keys)
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { query: "seo tool", pageUrl: "https://x/pricing", clicks: 10, impressions: 200, ctr: 0.05, position: 8.1 });
});

test("mapAveragePosition reads the aggregated position or null", () => {
  assert.equal(mapAveragePosition([{ clicks: 3, impressions: 50, ctr: 0.06, position: 14.7 }]), 14.7);
  assert.equal(mapAveragePosition([]), null);
});

test("countryFilterForMarket maps alpha-2 to GSC alpha-3, null when unknown", () => {
  assert.equal(countryFilterForMarket("DE"), "deu");
  assert.equal(countryFilterForMarket("us"), "usa");
  assert.equal(countryFilterForMarket("ZZ"), null);
  assert.equal(countryFilterForMarket(null), null);
});
