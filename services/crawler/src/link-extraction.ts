import { parsePage } from "./html-parse.js";

/**
 * All fetchable outgoing links (absolute, normalized, deduped) in document order.
 * Backed by the DOM parser — comments/scripts/styles are ignored and `<base href>`
 * is honoured. Includes nofollow links: this set feeds the broken-link audit, where
 * a 404 matters regardless of rel. Frontier following filters out nofollow via the
 * richer `parsePage(...).links` result.
 */
export function extractOutgoingLinks(html: string, baseUrl: string): string[] {
  return parsePage(html, baseUrl).links.map((link) => link.url);
}
