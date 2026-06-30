/**
 * Friendly action-error mapping.
 *
 * Server actions catch failures and redirect with `?error=…`, which the page then
 * renders verbatim in a notice. Internal API/network failures carry technical text
 * (API paths, HTTP status codes, "fetch failed", JS error names) that a non-expert
 * must never see — exactly the "API nicht erreichbar … bitte Backend prüfen" pattern
 * the product deliberately hides behind `OfflineNotice`.
 *
 * This helper passes through messages that were deliberately authored for users
 * (short German validation sentences) and replaces anything that looks technical
 * with a calm, generic message. The only way technical text reaches a `messageFor`
 * is via the API client's `"${method} ${path} failed with ${status}"` throws or a
 * native fetch failure — both are caught by the signatures below.
 */

const TECHNICAL_SIGNATURES: RegExp[] = [
  /failed with \d/i,
  /\bfetch\b/i,
  /\b(ECONN\w*|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|EPIPE)\b/i,
  /\bsocket\b|\bnetwork\b/i,
  /\/api(\/|\b)/,
  /\/(projects|sites|reports|keywords|opportunities|crawls|audits)\//,
  /\b(Type|Syntax|Reference|Range)Error\b/,
  /cannot read|is not a function|is not defined/i,
  /\bundefined\b|\bnull\b/i,
];

const GENERIC_MESSAGE =
  "Das hat leider nicht geklappt. Bitte versuchen Sie es in einigen Minuten erneut.";

/**
 * Returns a user-safe German message for a caught action error.
 * @param error    the caught value
 * @param fallback message to use when the error is unusable or looks technical
 */
export function friendlyActionError(error: unknown, fallback: string = GENERIC_MESSAGE): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message?.trim();
  if (!message) return fallback;
  if (message.length > 200) return fallback;
  if (TECHNICAL_SIGNATURES.some((re) => re.test(message))) return fallback;
  return message;
}
