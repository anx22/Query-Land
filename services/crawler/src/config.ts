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
