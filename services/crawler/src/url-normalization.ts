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

export function isInCrawlScope(candidateUrl: string, baseUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const base = new URL(baseUrl);
    return candidate.protocol === base.protocol && candidate.hostname === base.hostname;
  } catch {
    return false;
  }
}

export function stableSlug(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}
