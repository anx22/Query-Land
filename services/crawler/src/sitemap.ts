import type { DiscoveredUrl, UrlDiscoverySource } from "@seo-tool/domain-model";
import type { CrawlSeedInput, SitemapDiscoveryInput, SitemapIndexDiscoveryInput } from "./types.js";
import { fetchUrl } from "./fetch-url.js";
import { isInCrawlScope, normalizeCrawlUrl, stableSlug } from "./url-normalization.js";

const DEFAULT_MAX_SITEMAP_INDEX_DEPTH = 1;
const DEFAULT_MAX_SITEMAP_FETCHES = 10;

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
  const locs = extractUrlsetLocations(input.sitemapXml);
  return discoveredUrlsFromLocations({ ...input, pageUrls: locs, discoveredFrom: input.sitemapUrl });
}

export async function discoverUrlsFromSitemapIndex(input: SitemapIndexDiscoveryInput): Promise<DiscoveredUrl[]> {
  if (!isSitemapIndex(input.sitemapXml)) {
    return discoverUrlsFromSitemap(input);
  }

  const maxDepth = Math.max(0, input.maxIndexDepth ?? DEFAULT_MAX_SITEMAP_INDEX_DEPTH);
  const maxFetches = Math.max(0, input.maxSitemapFetches ?? DEFAULT_MAX_SITEMAP_FETCHES);
  const pageUrls: Array<{ url: string; discoveredFrom: string; depth: number }> = [];
  const seenSitemaps = new Set<string>([normalizeCrawlUrl(input.sitemapUrl, input.baseUrl)]);
  let fetches = 0;

  async function visitSitemap(sitemapUrl: string, depth: number): Promise<void> {
    if (fetches >= maxFetches || depth > maxDepth || !isInCrawlScope(sitemapUrl, input.baseUrl)) return;
    fetches += 1;
    const sitemapFetch = await fetchUrl({
      url: sitemapUrl,
      fetchImpl: input.fetchImpl,
      fetchedAt: input.discoveredAt,
      timeoutMs: input.timeoutMs,
      retry: input.retry,
      maxRedirects: 3
    });
    if (!sitemapFetch.statusCode || sitemapFetch.statusCode < 200 || sitemapFetch.statusCode >= 300) return;
    const sitemapXml = sitemapFetch.responseBody ?? "";
    if (isSitemapIndex(sitemapXml)) {
      for (const nestedSitemapUrl of extractSitemapIndexLocations(sitemapXml).map((url) => normalizeCrawlUrl(url, sitemapUrl))) {
        if (seenSitemaps.has(nestedSitemapUrl)) continue;
        seenSitemaps.add(nestedSitemapUrl);
        await visitSitemap(nestedSitemapUrl, depth + 1);
      }
      return;
    }

    for (const pageUrl of extractUrlsetLocations(sitemapXml)) {
      pageUrls.push({ url: pageUrl, discoveredFrom: sitemapUrl, depth: depth + 1 });
    }
  }

  for (const sitemapUrl of extractSitemapIndexLocations(input.sitemapXml).map((url) => normalizeCrawlUrl(url, input.sitemapUrl))) {
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    await visitSitemap(sitemapUrl, 1);
  }

  return discoveredUrlsFromLocations({ ...input, pageUrls, discoveredFrom: input.sitemapUrl });
}

export function extractSitemapLocations(sitemapXml: string): string[] {
  return [...new Set([...extractUrlsetLocations(sitemapXml), ...extractSitemapIndexLocations(sitemapXml)])];
}

export function extractSitemapIndexLocations(sitemapXml: string): string[] {
  if (!isSitemapIndex(sitemapXml)) return [];
  return [...sitemapXml.matchAll(/<sitemap\b[^>]*>[\s\S]*?<loc>\s*([^<]+?)\s*<\/loc>[\s\S]*?<\/sitemap>/gi)].map((match) => decodeXml(match[1] ?? ""));
}

export function extractUrlsetLocations(sitemapXml: string): string[] {
  if (isSitemapIndex(sitemapXml)) return [];
  return [...sitemapXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeXml(match[1] ?? ""));
}

function discoveredUrlsFromLocations(input: SitemapDiscoveryInput & { pageUrls: string[] | Array<{ url: string; discoveredFrom: string; depth: number }>; discoveredFrom: string }): DiscoveredUrl[] {
  const pageEntries = input.pageUrls.map((entry) => typeof entry === "string" ? { url: entry, discoveredFrom: input.discoveredFrom, depth: 1 } : entry);
  const uniqueUrls = [...new Set([input.baseUrl, ...pageEntries.map((entry) => entry.url)])];
  return uniqueUrls.map((url, index) => {
    const pageEntry = pageEntries.find((entry) => entry.url === url);
    return createDiscoveredUrl({
      projectId: input.projectId,
      siteId: input.siteId,
      baseUrl: input.baseUrl,
      url,
      source: index === 0 ? "seed" : "sitemap",
      discoveredFrom: index === 0 ? null : pageEntry?.discoveredFrom ?? input.discoveredFrom,
      depth: index === 0 ? 0 : pageEntry?.depth ?? 1,
      discoveredAt: input.discoveredAt
    });
  });
}

function isSitemapIndex(sitemapXml: string): boolean {
  return /<sitemapindex\b/i.test(sitemapXml);
}

function decodeXml(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}
