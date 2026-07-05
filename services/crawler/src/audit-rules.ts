import type { AuditIssue } from "@seo-tool/domain-model";
import { parsePage, type ParsedPage } from "./html-parse.js";
import type { AuditPageInput } from "./types.js";
import { canonicalKey, stableSlug } from "./url-normalization.js";

// On-page thresholds — the values common site-audit tools (Screaming Frog / Ahrefs / Semrush) use.
const TITLE_MAX_CHARS = 60;
const TITLE_MIN_CHARS = 10;
const META_DESCRIPTION_MAX_CHARS = 160;
const META_DESCRIPTION_MIN_CHARS = 50;
const THIN_CONTENT_MIN_WORDS = 150;

export function evaluateAuditIssues(pages: AuditPageInput[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  // Parse each page once (reusing the crawl-cycle parse when present) and share
  // the result across the cross-page dedupe passes and the per-page rule pass.
  const parsedByIndex: ParsedPage[] = pages.map((page) => page.parsed ?? parsePage(page.html ?? "", page.finalUrl ?? page.url));

  // Duplicate title/meta-description detection counts values ONLY across successfully fetched (2xx)
  // pages, so an error page can never inflate a duplicate count.
  const titleCounts = new Map<string, number>();
  const descriptionCounts = new Map<string, number>();
  for (let index = 0; index < pages.length; index += 1) {
    if (!isSuccessStatus(pages[index]!.statusCode)) continue;
    const parsed = parsedByIndex[index]!;
    if (parsed.title) titleCounts.set(parsed.title, (titleCounts.get(parsed.title) ?? 0) + 1);
    const description = parsed.onPage.metaDescription;
    if (description) descriptionCounts.set(description, (descriptionCounts.get(description) ?? 0) + 1);
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
    // response carries no meaningful content — flagging "missing title" on a 503 is a false
    // positive, so every content rule is gated behind a 2xx status.
    if (isSuccessStatus(page.statusCode)) {
      evaluateOnPageRules(issues, page.url, finalUrl, parsed, titleCounts, descriptionCounts);
    }

    for (const link of page.outgoingLinks ?? []) {
      if (link.statusCode === null || link.statusCode >= 400) {
        issues.push(issue(page.url, "broken_link", "high", `Broken outgoing link: ${link.url}.`));
      }
    }
  });

  return issues;
}

/** The standard on-page rule battery for one successfully fetched (2xx) page. */
function evaluateOnPageRules(
  issues: AuditIssue[],
  url: string,
  finalUrl: string,
  parsed: ParsedPage,
  titleCounts: Map<string, number>,
  descriptionCounts: Map<string, number>
): void {
  const { title, canonicalUrl } = parsed;
  const { metaDescription, h1Count, wordCount, imagesMissingAlt, hasViewport, htmlLang, hreflangInvalid, hasJsonLd, mixedContentCount } = parsed.onPage;

  // Title
  if (!title) {
    issues.push(issue(url, "missing_title", "medium", "Page is missing a title element."));
  } else {
    if ((titleCounts.get(title) ?? 0) > 1) issues.push(issue(url, "duplicate_title", "low", `Title is duplicated: ${title}.`));
    if (title.length > TITLE_MAX_CHARS) issues.push(issue(url, "title_too_long", "low", `Title is ${title.length} chars (over ${TITLE_MAX_CHARS}) and may be truncated in search results.`));
    else if (title.length < TITLE_MIN_CHARS) issues.push(issue(url, "title_too_short", "low", `Title is only ${title.length} chars (under ${TITLE_MIN_CHARS}).`));
  }

  // Canonical — compare via canonicalKey so a normal www↔apex / http↔https self-canonical is fine.
  if (!canonicalUrl) {
    issues.push(issue(url, "missing_canonical", "low", "Page has no self-referencing canonical link."));
  } else if (canonicalKey(canonicalUrl, finalUrl) !== canonicalKey(finalUrl, finalUrl)) {
    issues.push(issue(url, "canonical_mismatch", "medium", `Canonical does not match final URL: ${canonicalUrl}.`));
  }

  // Meta description
  if (!metaDescription) {
    issues.push(issue(url, "missing_meta_description", "medium", "Page is missing a meta description."));
  } else {
    if ((descriptionCounts.get(metaDescription) ?? 0) > 1) issues.push(issue(url, "duplicate_meta_description", "low", "Meta description is duplicated across pages."));
    if (metaDescription.length > META_DESCRIPTION_MAX_CHARS) issues.push(issue(url, "meta_description_too_long", "low", `Meta description is ${metaDescription.length} chars (over ${META_DESCRIPTION_MAX_CHARS}).`));
    else if (metaDescription.length < META_DESCRIPTION_MIN_CHARS) issues.push(issue(url, "meta_description_too_short", "low", `Meta description is only ${metaDescription.length} chars (under ${META_DESCRIPTION_MIN_CHARS}).`));
  }

  // Headings & content
  if (h1Count === 0) issues.push(issue(url, "missing_h1", "medium", "Page has no <h1> heading."));
  else if (h1Count > 1) issues.push(issue(url, "multiple_h1", "low", `Page has ${h1Count} <h1> headings (expected 1).`));
  if (wordCount < THIN_CONTENT_MIN_WORDS) issues.push(issue(url, "thin_content", "low", `Page has only ${wordCount} words (under ${THIN_CONTENT_MIN_WORDS}); may be thin content.`));

  // Media, mobile, i18n & structured data
  if (imagesMissingAlt > 0) issues.push(issue(url, "image_missing_alt", "low", `${imagesMissingAlt} image(s) have no alt attribute.`));
  if (!hasViewport) issues.push(issue(url, "missing_viewport", "medium", "Page has no mobile viewport meta tag."));
  if (!htmlLang) issues.push(issue(url, "missing_html_lang", "low", "Page has no <html lang> attribute."));
  if (mixedContentCount > 0) issues.push(issue(url, "mixed_content", "high", `${mixedContentCount} insecure http:// resource(s) loaded on an https page.`));
  if (hreflangInvalid) issues.push(issue(url, "hreflang_invalid", "low", "Page has a malformed hreflang annotation."));
  if (!hasJsonLd) issues.push(issue(url, "structured_data_missing", "low", "Page has no JSON-LD structured data."));
}

/** A 2xx response — the only class for which on-page content rules are meaningful. */
function isSuccessStatus(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300;
}

function issue(url: string, rule: AuditIssue["rule"], severity: AuditIssue["severity"], message: string): AuditIssue {
  return { id: `issue-${stableSlug(`${url}-${rule}-${message}`)}`, url, rule, severity, message };
}
