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
import { normalizeCrawlUrl } from "./url-normalization.js";

export interface ParsedLink {
  /** Normalized, absolute http(s) URL (fragment stripped, base-resolved). */
  url: string;
  /** True when the anchor's rel attribute contains `nofollow` (frontier skips it). */
  nofollow: boolean;
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
}

/**
 * Parse a page once. `pageUrl` is the URL the body was fetched from (the final
 * URL after redirects) — used as the resolution base unless the document carries
 * a `<base href>`.
 */
export function parsePage(html: string, pageUrl: string): ParsedPage {
  const root = parse(html ?? "", { comment: false });
  const base = resolveBase(root, pageUrl);
  return {
    title: extractTitle(root),
    canonicalUrl: extractCanonical(root),
    robotsMeta: extractRobotsMeta(root),
    links: extractLinks(root, base)
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
    const existing = byUrl.get(normalized);
    if (!existing) {
      byUrl.set(normalized, { url: normalized, nofollow });
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
