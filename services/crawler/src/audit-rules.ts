import type { AuditIssue } from "@seo-tool/domain-model";
import { parsePage, type ParsedPage } from "./html-parse.js";
import type { AuditPageInput } from "./types.js";
import { canonicalKey, stableSlug } from "./url-normalization.js";

export function evaluateAuditIssues(pages: AuditPageInput[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  // Parse each page once (reusing the crawl-cycle parse when present) and share
  // the result across the title-dedupe pass and the per-page rule pass.
  const parsedByIndex: ParsedPage[] = pages.map((page) => page.parsed ?? parsePage(page.html ?? "", page.finalUrl ?? page.url));
  const titleCounts = new Map<string, number>();

  // Duplicate-title detection counts titles ONLY across successfully fetched (2xx) pages, so an
  // error page's (absent or boilerplate) title can never inflate a duplicate count.
  for (let index = 0; index < pages.length; index += 1) {
    const parsed = parsedByIndex[index]!;
    if (isSuccessStatus(pages[index]!.statusCode) && parsed.title) {
      titleCounts.set(parsed.title, (titleCounts.get(parsed.title) ?? 0) + 1);
    }
  }

  pages.forEach((page, index) => {
    const parsed = parsedByIndex[index]!;
    const finalUrl = page.finalUrl ?? page.url;

    if (page.statusCode === null || page.statusCode >= 400) {
      issues.push(issue(page.url, "http_error", page.statusCode !== null && page.statusCode >= 500 ? "critical" : "high", `HTTP fetch returned ${page.statusCode ?? "network error"}.`));
    }

    if (page.statusCode !== null && page.statusCode >= 300 && page.statusCode < 400) {
      issues.push(issue(page.url, "redirect_chain", "medium", "URL returns a redirect response."));
    }

    // On-page content rules only apply to a successfully fetched (2xx) HTML page. A 3xx/4xx/5xx
    // response carries no meaningful title/canonical — flagging "missing title" on a 503 is a
    // false positive, so every content rule is gated behind a 2xx status.
    if (isSuccessStatus(page.statusCode)) {
      const title = parsed.title;
      const canonicalUrl = parsed.canonicalUrl;

      if (!title) {
        issues.push(issue(page.url, "missing_title", "medium", "Page is missing a title element."));
      } else if ((titleCounts.get(title) ?? 0) > 1) {
        issues.push(issue(page.url, "duplicate_title", "low", `Title is duplicated: ${title}.`));
      }

      // Compare via canonicalKey so a normal www↔apex / http↔https self-canonical is NOT flagged.
      if (canonicalUrl && canonicalKey(canonicalUrl, finalUrl) !== canonicalKey(finalUrl, finalUrl)) {
        issues.push(issue(page.url, "canonical_mismatch", "medium", `Canonical does not match final URL: ${canonicalUrl}.`));
      }
    }

    for (const link of page.outgoingLinks ?? []) {
      if (link.statusCode === null || link.statusCode >= 400) {
        issues.push(issue(page.url, "broken_link", "high", `Broken outgoing link: ${link.url}.`));
      }
    }
  });

  return issues;
}

/** A 2xx response — the only class for which on-page content rules are meaningful. */
function isSuccessStatus(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300;
}

function issue(url: string, rule: AuditIssue["rule"], severity: AuditIssue["severity"], message: string): AuditIssue {
  return { id: `issue-${stableSlug(`${url}-${rule}-${message}`)}`, url, rule, severity, message };
}
