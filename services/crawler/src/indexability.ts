import type { IndexabilityAssessment } from "@seo-tool/domain-model";
import { parsePage } from "./html-parse.js";
import type { AuditPageInput } from "./types.js";
import { normalizeCrawlUrl } from "./url-normalization.js";

export function assessIndexability(input: AuditPageInput): IndexabilityAssessment {
  const headers = lowercaseHeaders(input.headers ?? {});
  const finalUrl = input.finalUrl ?? input.url;
  const parsed = input.parsed ?? parsePage(input.html ?? "", finalUrl);
  const canonicalUrl = parsed.canonicalUrl;
  const robotsMeta = parsed.robotsMeta;
  const xRobots = headers["x-robots-tag"] ?? "";

  if (input.statusCode === null || input.statusCode >= 400 || input.statusCode < 200) {
    return assessment(input.url, "blocked_by_status", false, [`HTTP status ${input.statusCode ?? "network_error"}`], canonicalUrl);
  }

  if (/noindex/i.test(xRobots)) {
    return assessment(input.url, "blocked_by_x_robots", false, ["X-Robots-Tag contains noindex"], canonicalUrl);
  }

  if (/noindex/i.test(robotsMeta)) {
    return assessment(input.url, "blocked_by_meta", false, ["robots meta contains noindex"], canonicalUrl);
  }

  if (canonicalUrl && normalizeCrawlUrl(canonicalUrl, finalUrl) !== normalizeCrawlUrl(finalUrl, finalUrl)) {
    return assessment(input.url, "canonicalized", false, [`Canonical points to ${canonicalUrl}`], canonicalUrl);
  }

  return assessment(input.url, "indexable", true, [], canonicalUrl);
}

function lowercaseHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function assessment(url: string, state: IndexabilityAssessment["state"], isIndexable: boolean, reasons: string[], canonicalUrl: string | null): IndexabilityAssessment {
  return { url, state, isIndexable, reasons, canonicalUrl };
}
