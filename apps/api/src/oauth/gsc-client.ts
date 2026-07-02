/**
 * gsc-client.ts — thin Google Search Console / OAuth2 HTTP client.
 *
 * Uses native fetch (which honours HTTPS_PROXY in this environment) — no googleapis dependency. The
 * fetch implementation is injectable so the client can be unit-tested fully offline. Pure response
 * mappers are exported for direct testing.
 *
 * Never log access/refresh tokens or full auth headers.
 */
import type { SearchAnalyticsRow } from "../search-performance/index.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SITES_ENDPOINT = "https://www.googleapis.com/webmasters/v3/sites";
const SEARCH_ANALYTICS_BASE = "https://www.googleapis.com/webmasters/v3/sites";
const URL_INSPECTION_ENDPOINT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

export const GSC_OAUTH_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export type FetchImpl = typeof fetch;

export interface GscTokens {
  accessToken: string;
  /** May be absent on a refresh response — callers preserve the prior refresh token. */
  refreshToken?: string;
  /** ISO timestamp when the access token expires. */
  expiresAt: string;
}

export interface GscSiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

export interface SearchAnalyticsQueryBody {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  dimensionFilterGroups?: Array<{ filters: Array<{ dimension: string; operator: string; expression: string }> }>;
  rowLimit?: number;
}

export interface GscApiRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Normalised URL Inspection result (index coverage). Shares the webmasters.readonly scope. */
export interface UrlInspectionResult {
  /** Google's overall verdict: PASS | PARTIAL | FAIL | NEUTRAL | VERDICT_UNSPECIFIED. */
  verdict: string | null;
  /** Human-readable coverage state, e.g. "Submitted and indexed" / "URL is unknown to Google". */
  coverageState: string | null;
  /** True when Google reports the URL as indexed (coverageState indicates it is in the index). */
  indexed: boolean;
  lastCrawlTime: string | null;
}

export class GscApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "GscApiError";
  }
  /** Auth failures (bad/expired/revoked credentials) — caller should mark the integration broken. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403 || this.code === "invalid_grant";
  }
}

export interface GscClientOptions {
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchImpl;
}

export interface GscClient {
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<GscTokens>;
  refreshAccessToken(refreshToken: string): Promise<GscTokens>;
  listSites(accessToken: string): Promise<GscSiteEntry[]>;
  querySearchAnalytics(accessToken: string, property: string, body: SearchAnalyticsQueryBody): Promise<GscApiRow[]>;
  /** URL Inspection API — index coverage for one URL (same webmasters.readonly scope). */
  inspectUrl(accessToken: string, siteUrl: string, inspectionUrl: string): Promise<UrlInspectionResult>;
}

export type GscClientFactory = (opts: GscClientOptions) => GscClient;

function expiresAtFrom(expiresIn: unknown): string {
  const seconds = typeof expiresIn === "number" && Number.isFinite(expiresIn) ? expiresIn : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function createGscClient({ clientId, clientSecret, fetchImpl }: GscClientOptions): GscClient {
  const doFetch: FetchImpl = fetchImpl ?? fetch;

  async function tokenRequest(params: Record<string, string>): Promise<GscTokens> {
    const res = await doFetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new GscApiError(`Token request failed (${res.status})`, res.status, typeof json.error === "string" ? json.error : undefined);
    }
    return {
      accessToken: String(json.access_token ?? ""),
      refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
      expiresAt: expiresAtFrom(json.expires_in),
    };
  }

  async function authedGet(accessToken: string, url: string): Promise<Record<string, unknown>> {
    const res = await doFetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new GscApiError(`GSC GET failed (${res.status})`, res.status);
    return json;
  }

  return {
    exchangeCodeForTokens(code, redirectUri) {
      return tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
    },
    refreshAccessToken(refreshToken) {
      return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
    },
    async listSites(accessToken) {
      const json = await authedGet(accessToken, SITES_ENDPOINT);
      const entries = Array.isArray(json.siteEntry) ? json.siteEntry : [];
      return entries
        .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
        .map((e) => ({ siteUrl: String(e.siteUrl ?? ""), permissionLevel: String(e.permissionLevel ?? "") }));
    },
    async querySearchAnalytics(accessToken, property, body) {
      const url = `${SEARCH_ANALYTICS_BASE}/${encodeURIComponent(property)}/searchAnalytics/query`;
      const res = await doFetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new GscApiError(`Search Analytics query failed (${res.status})`, res.status);
      return Array.isArray(json.rows) ? (json.rows as GscApiRow[]) : [];
    },
    async inspectUrl(accessToken, siteUrl, inspectionUrl) {
      const res = await doFetch(URL_INSPECTION_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ inspectionUrl, siteUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new GscApiError(`URL inspection failed (${res.status})`, res.status);
      return mapUrlInspection(json);
    },
  };
}

/** Map a URL Inspection API response to our normalised shape. `indexed` = Google's PASS verdict. */
export function mapUrlInspection(json: Record<string, unknown>): UrlInspectionResult {
  const inspection = (json.inspectionResult ?? {}) as Record<string, unknown>;
  const index = (inspection.indexStatusResult ?? {}) as Record<string, unknown>;
  const verdict = typeof index.verdict === "string" ? index.verdict : null;
  const coverageState = typeof index.coverageState === "string" ? index.coverageState : null;
  const lastCrawlTime = typeof index.lastCrawlTime === "string" ? index.lastCrawlTime : null;
  return { verdict, coverageState, indexed: verdict === "PASS", lastCrawlTime };
}

// ---------------------------------------------------------------------------
// Pure mappers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Map GSC rows queried with dimensions ["query","page"] to the search-performance row shape. */
export function mapSearchAnalyticsRows(rows: GscApiRow[]): SearchAnalyticsRow[] {
  return rows
    .filter((row) => Array.isArray(row.keys) && row.keys.length >= 2)
    .map((row) => ({
      query: String(row.keys![0]),
      pageUrl: String(row.keys![1]),
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
    }));
}

/** Aggregate average position from a single-query result (no row dimensions). */
export function mapAveragePosition(rows: GscApiRow[]): number | null {
  if (rows.length === 0) return null;
  const position = Number(rows[0].position);
  return Number.isFinite(position) ? position : null;
}

// ISO-3166-1 alpha-2 → alpha-3 lowercase, as required by the GSC `country` dimension filter.
const COUNTRY_ALPHA3: Record<string, string> = {
  DE: "deu", AT: "aut", CH: "che", US: "usa", GB: "gbr", FR: "fra", IT: "ita", ES: "esp",
  NL: "nld", BE: "bel", PL: "pol", SE: "swe", DK: "dnk", NO: "nor", FI: "fin", PT: "prt",
  IE: "irl", CZ: "cze", CA: "can", AU: "aus",
};

/** GSC country filter value for a project market (alpha-2). Returns null when unknown (no filter). */
export function countryFilterForMarket(market: string | null | undefined): string | null {
  if (!market) return null;
  return COUNTRY_ALPHA3[market.trim().toUpperCase()] ?? null;
}
