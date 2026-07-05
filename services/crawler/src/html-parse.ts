/**
 * html-parse.ts — single, DOM-based HTML parse for the crawl pipeline.
 *
 * Replaces the previous per-field regexes (link/title/canonical/robots) with one
 * `node-html-parser` pass per page. The DOM parser is what real crawlers use: it
 * ignores markup inside comments, <script> and <style> (so analytics snippets,
 * commented-out anchors and JSON-LD URLs are NOT mistaken for real links), honours
 * `<base href>` for relative-URL resolution, and decodes HTML entities in both
 * attributes and text. `crawl-cycle.ts` parses each page ONCE and threads the
 * result through indexability + audit + link-following, so a page is never parsed
 * more than necessary.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { OnPageSignals } from "@seo-tool/domain-model";
import { normalizeCrawlUrl } from "./url-normalization.js";

export interface ParsedLink {
  /** Normalized, absolute http(s) URL (fragment stripped, base-resolved). */
  url: string;
  /** True when the anchor's rel attribute contains `nofollow` (frontier skips it). */
  nofollow: boolean;
  /** Visible anchor text (whitespace-collapsed), or null when empty. First occurrence wins. */
  anchor: string | null;
  /** Raw `rel` attribute value, or null when absent. */
  rel: string | null;
}

export interface ParsedPage {
  /** Trimmed, whitespace-collapsed <title>, or null when absent/empty. */
  title: string | null;
  /** Raw href of the first <link rel="canonical">, or null. Resolved by callers. */
  canonicalUrl: string | null;
  /** Raw content of <meta name="robots">, or "" when absent. */
  robotsMeta: string;
  /** Fetchable links in document order, deduped by normalized URL. */
  links: ParsedLink[];
  /** On-page SEO signals (Master-Spec §5 M2). Durable across the resumable crawl path. */
  onPage: OnPageSignals;
}

export type { OnPageSignals };

/**
 * Parse a page once. `pageUrl` is the URL the body was fetched from (the final
 * URL after redirects) — used as the resolution base unless the document carries
 * a `<base href>`.
 */
export function parsePage(html: string, pageUrl: string): ParsedPage {
  const root = parse(html ?? "", { comment: false });
  const base = resolveBase(root, pageUrl);
  // Signals that must be read BEFORE script/style nodes are stripped for the word count.
  const hasJsonLd = Boolean(root.querySelector('script[type="application/ld+json"]'));
  const mixedContentCount = countMixedContent(root, pageUrl);
  return {
    title: extractTitle(root),
    canonicalUrl: extractCanonical(root),
    robotsMeta: extractRobotsMeta(root),
    links: extractLinks(root, base),
    onPage: {
      metaDescription: extractMetaDescription(root),
      h1Count: root.querySelectorAll("h1").length,
      wordCount: countWords(root),
      imagesMissingAlt: countImagesMissingAlt(root),
      hasViewport: hasViewportMeta(root),
      htmlLang: extractHtmlLang(root),
      hreflangInvalid: hasInvalidHreflang(root, base),
      hasJsonLd,
      mixedContentCount
    }
  };
}

/** The effective resolution base: a valid `<base href>` overrides the page URL. */
function resolveBase(root: HTMLElement, pageUrl: string): string {
  const baseHref = root.querySelector("base[href]")?.getAttribute("href")?.trim();
  if (baseHref) {
    try {
      return new URL(baseHref, pageUrl).toString();
    } catch {
      // Malformed <base href> falls back to the page URL.
    }
  }
  return pageUrl;
}

function extractTitle(root: HTMLElement): string | null {
  const raw = root.querySelector("title")?.text ?? "";
  const title = raw.replace(/\s+/g, " ").trim();
  return title.length > 0 ? title : null;
}

/** First <link> whose rel token list contains `canonical` (case-insensitive). */
function extractCanonical(root: HTMLElement): string | null {
  for (const link of root.querySelectorAll("link[href]")) {
    if (relTokens(link).includes("canonical")) {
      const href = link.getAttribute("href")?.trim();
      if (href) return href;
    }
  }
  return null;
}

/** Content of the first <meta name="robots"> (case-insensitive on the name). */
function extractRobotsMeta(root: HTMLElement): string {
  for (const meta of root.querySelectorAll("meta[name]")) {
    if ((meta.getAttribute("name") ?? "").trim().toLowerCase() === "robots") {
      return (meta.getAttribute("content") ?? "").trim();
    }
  }
  return "";
}

/** Content of the first <meta name="description">, whitespace-collapsed, or null when absent/empty. */
function extractMetaDescription(root: HTMLElement): string | null {
  for (const meta of root.querySelectorAll("meta[name]")) {
    if ((meta.getAttribute("name") ?? "").trim().toLowerCase() === "description") {
      const content = (meta.getAttribute("content") ?? "").replace(/\s+/g, " ").trim();
      return content.length > 0 ? content : null;
    }
  }
  return null;
}

/** Visible word count of the body — script/style/noscript/template text excluded. */
function countWords(root: HTMLElement): number {
  for (const node of root.querySelectorAll("script, style, noscript, template")) {
    node.remove();
  }
  const text = (root.querySelector("body") ?? root).text ?? "";
  const tokens = text.replace(/\s+/g, " ").trim();
  return tokens.length === 0 ? 0 : tokens.split(" ").length;
}

/** Count of <img> elements with NO alt attribute at all (decorative alt="" is valid and NOT counted). */
function countImagesMissingAlt(root: HTMLElement): number {
  let missing = 0;
  for (const img of root.querySelectorAll("img")) {
    if (img.getAttribute("alt") === undefined) missing += 1;
  }
  return missing;
}

/** True when a non-empty <meta name="viewport"> is present (mobile-friendliness signal). */
function hasViewportMeta(root: HTMLElement): boolean {
  for (const meta of root.querySelectorAll("meta[name]")) {
    if ((meta.getAttribute("name") ?? "").trim().toLowerCase() === "viewport") {
      return (meta.getAttribute("content") ?? "").trim().length > 0;
    }
  }
  return false;
}

/** Trimmed <html lang="…"> attribute, or null when absent/empty. */
function extractHtmlLang(root: HTMLElement): string | null {
  const lang = (root.querySelector("html")?.getAttribute("lang") ?? "").trim();
  return lang.length > 0 ? lang : null;
}

/** BCP-47-ish language tag (or x-default) — a deliberately lenient check for hreflang validity. */
const HREFLANG_PATTERN = /^(x-default|[a-z]{2,3}(-[a-z0-9]{2,8})*)$/i;

/**
 * True when at least one hreflang alternate is malformed: an invalid language code or a missing/
 * unresolvable href. Absence of hreflang is NOT invalid (single-language sites are fine).
 */
function hasInvalidHreflang(root: HTMLElement, base: string): boolean {
  for (const link of root.querySelectorAll("link[hreflang]")) {
    if (!relTokens(link).includes("alternate")) continue;
    const code = (link.getAttribute("hreflang") ?? "").trim();
    if (!HREFLANG_PATTERN.test(code)) return true;
    const href = (link.getAttribute("href") ?? "").trim();
    if (!href) return true;
    try {
      new URL(href, base);
    } catch {
      return true;
    }
  }
  return false;
}

/** Non-empty src/href subresources that pull http:// content into an https page (mixed content). */
function countMixedContent(root: HTMLElement, pageUrl: string): number {
  let pageIsHttps = false;
  try {
    pageIsHttps = new URL(pageUrl).protocol === "https:";
  } catch {
    return 0;
  }
  if (!pageIsHttps) return 0;
  let count = 0;
  for (const el of root.querySelectorAll("img[src], script[src], iframe[src], source[src], video[src], audio[src], embed[src]")) {
    const src = (el.getAttribute("src") ?? "").trim();
    if (/^http:\/\//i.test(src)) count += 1;
  }
  return count;
}

function extractLinks(root: HTMLElement, base: string): ParsedLink[] {
  const byUrl = new Map<string, ParsedLink>();
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = (anchor.getAttribute("href") ?? "").trim();
    if (!href || href.startsWith("#") || !isFetchableHref(href)) continue;

    let normalized: string;
    try {
      normalized = normalizeCrawlUrl(href, base);
      const protocol = new URL(normalized).protocol;
      if (protocol !== "http:" && protocol !== "https:") continue;
    } catch {
      // Skip hrefs that do not resolve to a valid URL.
      continue;
    }

    const nofollow = relTokens(anchor).includes("nofollow");
    const anchorText = (anchor.text ?? "").replace(/\s+/g, " ").trim() || null;
    const rel = (anchor.getAttribute("rel") ?? "").trim() || null;
    const existing = byUrl.get(normalized);
    if (!existing) {
      byUrl.set(normalized, { url: normalized, nofollow, anchor: anchorText, rel });
    } else if (existing.nofollow && !nofollow) {
      // If the same URL is linked both with and without nofollow, treat it as
      // followable — a single followable path is enough to discover it.
      existing.nofollow = false;
    }
  }
  return [...byUrl.values()];
}

/** Lower-cased, whitespace-split rel token list for an element. */
function relTokens(element: HTMLElement): string[] {
  return (element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

/** Non-navigational schemes that must never enter the frontier or link checks. */
function isFetchableHref(href: string): boolean {
  return !/^(?:mailto|tel|javascript|data|blob|about|sms|ftp|file):/i.test(href);
}
