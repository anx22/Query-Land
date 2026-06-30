/** Crawl scope strategy (mirrors sites.scope_type). */
export type CrawlScopeType = "domain" | "subdomain" | "folder";

export function normalizeCrawlUrl(rawUrl: string, baseUrl: string): string {
  const url = new URL(rawUrl.trim(), baseUrl);
  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

/** Lower-cased host with a leading "www." removed — the apex we compare against. */
function hostApex(hostname: string): string {
  const host = hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

/**
 * Is `candidateUrl` within the crawl scope of `baseUrl` under `scopeType`?
 *
 * Scheme-tolerant (http/https are treated as the same site — sites routinely
 * redirect http→https) and www-tolerant (www.example.com ≡ example.com).
 *  - domain    : the apex domain and ALL its subdomains (incl. www).
 *  - subdomain : exactly the base host, modulo www.
 *  - folder    : same host (modulo www) AND the base URL's path prefix.
 *
 * Returns false on unparseable input.
 */
export function isInCrawlScope(candidateUrl: string, baseUrl: string, scopeType: CrawlScopeType = "domain"): boolean {
  let candidate: URL;
  let base: URL;
  try {
    candidate = new URL(candidateUrl);
    base = new URL(baseUrl);
  } catch {
    return false;
  }
  if (candidate.protocol !== "http:" && candidate.protocol !== "https:") return false;

  const cHost = candidate.hostname.toLowerCase();
  const bHost = base.hostname.toLowerCase();
  const bApex = hostApex(bHost);

  switch (scopeType) {
    case "subdomain":
      return hostApex(cHost) === hostApex(bHost) && stripWww(cHost) === stripWww(bHost);
    case "folder": {
      if (stripWww(cHost) !== stripWww(bHost)) return false;
      const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
      const candidatePath = candidate.pathname.endsWith("/") ? candidate.pathname : `${candidate.pathname}/`;
      return candidatePath.startsWith(basePath);
    }
    case "domain":
    default:
      // apex itself, or any subdomain of the apex (www, blog, shop, …).
      return cHost === bApex || cHost === `www.${bApex}` || cHost.endsWith(`.${bApex}`);
  }
}

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function stableSlug(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}
