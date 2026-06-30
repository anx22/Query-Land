import type { AuditIssue } from "@seo-tool/domain-model";
import { parsePage, type ParsedPage } from "./html-parse.js";
import type { AuditPageInput } from "./types.js";
import { normalizeCrawlUrl, stableSlug } from "./url-normalization.js";

export function evaluateAuditIssues(pages: AuditPageInput[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  // Parse each page once (reusing the crawl-cycle parse when present) and share
  // the result across the title-dedupe pass and the per-page rule pass.
  const parsedByIndex: ParsedPage[] = pages.map((page) => page.parsed ?? parsePage(page.html ?? "", page.finalUrl ?? page.url));
  const titleCounts = new Map<string, number>();

  for (const parsed of parsedByIndex) {
    if (parsed.title) {
      titleCounts.set(parsed.title, (titleCounts.get(parsed.title) ?? 0) + 1);
    }
  }

  pages.forEach((page, index) => {
    const parsed = parsedByIndex[index]!;
    const title = parsed.title;
    const finalUrl = page.finalUrl ?? page.url;
    const canonicalUrl = parsed.canonicalUrl;

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
  });

  return issues;
}

function issue(url: string, rule: AuditIssue["rule"], severity: AuditIssue["severity"], message: string): AuditIssue {
  return { id: `issue-${stableSlug(`${url}-${rule}-${message}`)}`, url, rule, severity, message };
}
