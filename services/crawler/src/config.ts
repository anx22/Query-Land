/**
 * Crawler-wide configuration constants.
 *
 * DEFAULT_CRAWLER_USER_AGENT is the identifying token sent on every crawl fetch
 * and used to select the matching robots.txt user-agent group. Keep it
 * descriptive so site owners can recognize and (dis)allow our crawler.
 */
export const DEFAULT_CRAWLER_USER_AGENT =
  "SeoToolBot/1.0 (+https://github.com/seo-tool)";

/** Base delay (ms) for the first retry when none is configured. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 100;

/** Cap (ms) for any single exponential-backoff wait. */
export const DEFAULT_RETRY_MAX_DELAY_MS = 5_000;

/** Default BFS link-following depth (0 = seed only). Seed/sitemap are depth 0. */
export const DEFAULT_MAX_DEPTH = 5;

/** Default cap on total URLs crawled per run (safety net against traps). */
export const DEFAULT_MAX_URLS = 150;

/**
 * Default cap (bytes) on a single response body we will read into memory and
 * parse. Protects the serverless worker from huge/malicious payloads; bodies
 * larger than this are read up to the cap and flagged truncated.
 */
export const DEFAULT_MAX_BODY_BYTES = 5_000_000;

/** Trap guard: skip enqueuing absurdly long URLs (session-id/param explosions). */
export const DEFAULT_MAX_URL_LENGTH = 2000;

/** Trap guard: cap distinct query-string variants enqueued per path (faceted-nav explosion). */
export const DEFAULT_MAX_DISTINCT_QUERY_PER_PATH = 20;

/** Politeness cap: never wait longer than this between same-host fetches, even if robots asks for more. */
export const DEFAULT_MAX_CRAWL_DELAY_MS = 10_000;

/** Default number of page fetches in flight at once (forced to 1 when a crawl-delay applies). */
export const DEFAULT_MAX_CONCURRENCY = 4;

/** Accept header sent on crawl fetches — we want HTML/XML, tolerate anything. */
export const DEFAULT_ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/**
 * Capped exponential backoff: base * 2^(attempt-1), clamped to maxDelay.
 * `attempt` is 1-based (1 = first retry). Returns 0 for non-positive base.
 */
export function backoffDelayMs(attempt: number, baseMs: number, maxMs: number): number {
  if (baseMs <= 0) return 0;
  const exponent = Math.max(0, attempt - 1);
  const raw = baseMs * 2 ** exponent;
  return Math.min(raw, maxMs);
}
