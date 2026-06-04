import { normalizeCrawlUrl } from "./url-normalization.js";

export function extractOutgoingLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    const href = decodeHtmlAttribute(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!href || href.startsWith("#") || !isFetchableHref(href)) {
      continue;
    }

    try {
      const normalized = normalizeCrawlUrl(href, baseUrl);
      const url = new URL(normalized);
      if (url.protocol === "http:" || url.protocol === "https:") {
        links.add(normalized);
      }
    } catch {
      // Ignore malformed href values while keeping link extraction best-effort.
    }
  }
  return [...links];
}

function isFetchableHref(href: string): boolean {
  return !/^(?:mailto|tel|javascript|data):/i.test(href);
}

function decodeHtmlAttribute(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&apos;", "'");
}
