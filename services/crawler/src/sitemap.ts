import type { DiscoveredUrl, UrlDiscoverySource } from "@seo-tool/domain-model";
import type { CrawlSeedInput, SitemapDiscoveryInput } from "./types.js";
import { normalizeCrawlUrl, stableSlug } from "./url-normalization.js";

export function createDiscoveredUrl(input: CrawlSeedInput & { url: string; source: UrlDiscoverySource; discoveredFrom?: string | null; depth?: number; discoveredAt?: string }): DiscoveredUrl {
  const normalizedUrl = normalizeCrawlUrl(input.url, input.baseUrl);
  return {
    id: `url-${stableSlug(`${input.projectId}-${input.siteId}-${normalizedUrl}`)}`,
    projectId: input.projectId,
    siteId: input.siteId,
    url: input.url,
    normalizedUrl,
    source: input.source,
    discoveredFrom: input.discoveredFrom ?? null,
    depth: input.depth ?? 0,
    discoveredAt: input.discoveredAt ?? new Date().toISOString()
  };
}

export function discoverUrlsFromSitemap(input: SitemapDiscoveryInput): DiscoveredUrl[] {
  const locs = extractSitemapLocations(input.sitemapXml);
  const uniqueUrls = [...new Set([input.baseUrl, ...locs])];
  return uniqueUrls.map((url, index) => createDiscoveredUrl({
    projectId: input.projectId,
    siteId: input.siteId,
    baseUrl: input.baseUrl,
    url,
    source: index === 0 ? "seed" : "sitemap",
    discoveredFrom: index === 0 ? null : input.sitemapUrl,
    depth: index === 0 ? 0 : 1,
    discoveredAt: input.discoveredAt
  }));
}

export function extractSitemapLocations(sitemapXml: string): string[] {
  return [...sitemapXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeXml(match[1] ?? ""));
}

function decodeXml(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}
