import type { AuditIssue } from "@seo-tool/domain-model";
import type { AuditPageInput } from "./types.js";
import { normalizeCrawlUrl, stableSlug } from "./url-normalization.js";

export function evaluateAuditIssues(pages: AuditPageInput[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const titleCounts = new Map<string, number>();

  for (const page of pages) {
    const title = extractTitle(page.html ?? "");
    if (title) {
      titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    }
  }

  for (const page of pages) {
    const title = extractTitle(page.html ?? "");
    const finalUrl = page.finalUrl ?? page.url;
    const canonicalUrl = extractCanonical(page.html ?? "");

    if (page.statusCode === null || page.statusCode >= 400) {
      issues.push(issue(page.url, "http_error", page.statusCode !== null && page.statusCode >= 500 ? "critical" : "high", `HTTP fetch returned ${page.statusCode ?? "network error"}.`));
    }

    if (page.statusCode !== null && page.statusCode >= 300 && page.statusCode < 400) {
      issues.push(issue(page.url, "redirect_chain", "medium", "URL returns a redirect response."));
    }

    if (!title) {
      issues.push(issue(page.url, "missing_title", "medium", "Page is missing a title element."));
    } else if ((titleCounts.get(title) ?? 0) > 1) {
      issues.push(issue(page.url, "duplicate_title", "low", `Title is duplicated: ${title}.`));
    }

    if (canonicalUrl && normalizeCrawlUrl(canonicalUrl, finalUrl) !== normalizeCrawlUrl(finalUrl, finalUrl)) {
      issues.push(issue(page.url, "canonical_mismatch", "medium", `Canonical does not match final URL: ${canonicalUrl}.`));
    }

    for (const link of page.outgoingLinks ?? []) {
      if (link.statusCode === null || link.statusCode >= 400) {
        issues.push(issue(page.url, "broken_link", "high", `Broken outgoing link: ${link.url}.`));
      }
    }
  }

  return issues;
}

function issue(url: string, rule: AuditIssue["rule"], severity: AuditIssue["severity"], message: string): AuditIssue {
  return { id: `issue-${stableSlug(`${url}-${rule}-${message}`)}`, url, rule, severity, message };
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = match?.[1]?.trim();
  return title ? decodeXml(title) : null;
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match?.[1]?.trim() ?? null;
}

function decodeXml(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}
