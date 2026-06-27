/**
 * adapters.ts — real provider adapters (GSC / PageSpeed / Lighthouse).
 *
 * Each adapter performs ONE real HTTPS call (native fetch, which honours HTTPS_PROXY here) and
 * maps the response to the connector's existing normalized {metric,value} rows. The fetch impl
 * is injectable so the whole thing is unit-testable offline. On non-2xx / network error / quota
 * the adapter returns a TYPED degraded/quota_exceeded/expired outcome with a clear reason — it
 * NEVER throws a raw error at the connector seam.
 *
 * Per the documented seam, only fetch()'s success branch is replaced. Without real credentials
 * (resolve* returns null) the connector keeps using the deterministic stub.
 *
 * Never log token/key values.
 */
import type { ConnectorFetchResult } from "./index.js";
import type { ResolvedGscCredentials, ResolvedPsiCredentials } from "./credential-resolution.js";

export type FetchImpl = typeof fetch;

interface MetricRow {
  metric: string;
  value: number;
}

const GSC_SEARCH_ANALYTICS_BASE = "https://www.googleapis.com/webmasters/v3/sites";
const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Map an HTTP status / thrown error to a typed, non-throwing degraded result. */
function failureResult(provider: string, status: number | null, message: string, now: string): ConnectorFetchResult {
  // 429 (rate limit) / 403 over-quota → quota_exceeded; 401 / token-expiry → expired; else degraded.
  let outcome: ConnectorFetchResult["outcome"] = "degraded";
  if (status === 429) outcome = "quota_exceeded";
  else if (status === 401) outcome = "expired";
  const reason = status === null
    ? `${provider} live fetch failed (network error): ${message}`
    : `${provider} live fetch returned ${status}: ${message}`;
  return { outcome, payload: null, quotaRemaining: null, quota: null, freshness: now, reason };
}

function okResult(rows: MetricRow[], now: string): ConnectorFetchResult {
  // Live calls don't expose a deterministic budget; surface freshness + the live rows. quota stays
  // null (the describe() contract reports the configured budget separately).
  return { outcome: "ok", payload: { rows }, quotaRemaining: null, quota: null, freshness: now };
}

// ---------------------------------------------------------------------------
// GSC (Search Console) — Search Analytics API
// ---------------------------------------------------------------------------

/** Pure mapper: aggregate GSC Search Analytics rows into the gsc connector's metric rows. */
export function mapGscRows(rows: unknown): MetricRow[] {
  const list = Array.isArray(rows) ? rows : [];
  let clicks = 0;
  let impressions = 0;
  let ctrSum = 0;
  let positionSum = 0;
  for (const r of list) {
    const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    clicks += num(row.clicks);
    impressions += num(row.impressions);
    ctrSum += num(row.ctr);
    positionSum += num(row.position);
  }
  const n = list.length || 1;
  return [
    { metric: "clicks", value: clicks },
    { metric: "impressions", value: impressions },
    { metric: "ctr", value: ctrSum / n },
    { metric: "position", value: positionSum / n }
  ];
}

export async function fetchGscLive(
  creds: ResolvedGscCredentials,
  opts: { property: string | null; now: string; fetchImpl: FetchImpl }
): Promise<ConnectorFetchResult> {
  const property = creds.property ?? opts.property;
  if (!property) {
    return { outcome: "degraded", payload: null, quotaRemaining: null, quota: null, freshness: opts.now, reason: "gsc has credentials but no property/site configured to query" };
  }
  // 28-day window ending yesterday (deterministic relative to ctx.now).
  const end = new Date(opts.now);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const body = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    rowLimit: 1
  };
  const url = `${GSC_SEARCH_ANALYTICS_BASE}/${encodeURIComponent(property)}/searchAnalytics/query`;
  try {
    const res = await opts.fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${creds.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = typeof json.error === "object" && json.error ? String((json.error as Record<string, unknown>).message ?? res.statusText) : res.statusText;
      return failureResult("gsc", res.status, msg, opts.now);
    }
    return okResult(mapGscRows(json.rows), opts.now);
  } catch (error) {
    return failureResult("gsc", null, error instanceof Error ? error.message : String(error), opts.now);
  }
}

// ---------------------------------------------------------------------------
// PageSpeed Insights (PSI) — also the source of Lighthouse data
// ---------------------------------------------------------------------------

/** Pure mapper: PSI loadingExperience/lab metrics → psi connector metric rows. */
export function mapPsiRows(json: Record<string, unknown>): MetricRow[] {
  const lr = (json.lighthouseResult && typeof json.lighthouseResult === "object" ? json.lighthouseResult : {}) as Record<string, unknown>;
  const audits = (lr.audits && typeof lr.audits === "object" ? lr.audits : {}) as Record<string, unknown>;
  const auditValue = (id: string): number => {
    const audit = (audits[id] && typeof audits[id] === "object" ? audits[id] : {}) as Record<string, unknown>;
    return num(audit.numericValue);
  };
  return [
    { metric: "lcp_ms", value: auditValue("largest-contentful-paint") },
    { metric: "cls", value: auditValue("cumulative-layout-shift") },
    { metric: "inp_ms", value: auditValue("interaction-to-next-paint") || auditValue("experimental-interaction-to-next-paint") },
    { metric: "ttfb_ms", value: auditValue("server-response-time") }
  ];
}

/** Pure mapper: PSI lighthouseResult.categories → lighthouse connector metric rows (0..1 scores). */
export function mapLighthouseRows(json: Record<string, unknown>): MetricRow[] {
  const lr = (json.lighthouseResult && typeof json.lighthouseResult === "object" ? json.lighthouseResult : {}) as Record<string, unknown>;
  const categories = (lr.categories && typeof lr.categories === "object" ? lr.categories : {}) as Record<string, unknown>;
  const score = (id: string): number => {
    const cat = (categories[id] && typeof categories[id] === "object" ? categories[id] : {}) as Record<string, unknown>;
    return num(cat.score);
  };
  return [
    { metric: "performance", value: score("performance") },
    { metric: "accessibility", value: score("accessibility") },
    { metric: "best_practices", value: score("best-practices") },
    { metric: "seo", value: score("seo") }
  ];
}

export async function fetchPsiLive(
  creds: ResolvedPsiCredentials,
  opts: { siteUrl: string | null; now: string; fetchImpl: FetchImpl; variant: "psi" | "lighthouse" }
): Promise<ConnectorFetchResult> {
  if (!opts.siteUrl) {
    return { outcome: "degraded", payload: null, quotaRemaining: null, quota: null, freshness: opts.now, reason: `${opts.variant} has an API key but no site URL to analyze` };
  }
  const url = `${PSI_ENDPOINT}?url=${encodeURIComponent(opts.siteUrl)}&key=${encodeURIComponent(creds.apiKey)}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=mobile`;
  try {
    const res = await opts.fetchImpl(url, { method: "GET" });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = typeof json.error === "object" && json.error ? String((json.error as Record<string, unknown>).message ?? res.statusText) : res.statusText;
      return failureResult(opts.variant, res.status, msg, opts.now);
    }
    const rows = opts.variant === "lighthouse" ? mapLighthouseRows(json) : mapPsiRows(json);
    return okResult(rows, opts.now);
  } catch (error) {
    return failureResult(opts.variant, null, error instanceof Error ? error.message : String(error), opts.now);
  }
}
