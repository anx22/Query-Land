import { json, type ApiResponse } from "../http.js";
import { enumQuery, pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

export const routeInternalLinks: ResourceRoute = (store, method, pathname, searchParams, body): ApiResponse | null => {
  const linksMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/internal-links$/);
  if (linksMatch) {
    if (method === "POST") {
      const edges = (body && typeof body === "object" && Array.isArray((body as { edges?: unknown }).edges))
        ? (body as { edges: Array<{ fromUrl: string; toUrl: string; anchor?: string | null; rel?: string | null }> }).edges
        : [];
      const result = store.recordInternalLinks(linksMatch[1], linksMatch[2], edges);
      return json(201, { data: result });
    }
    if (method === "GET") {
      const direction = enumQuery(searchParams, "direction", ["in", "out"]) ?? "out";
      const url = searchParams.get("url") ?? "";
      const page = store.listInternalLinks(linksMatch[1], linksMatch[2], direction, url, paginationOptions(searchParams));
      return json(200, { data: page.data, meta: pageMeta(page) });
    }
    return null;
  }

  const orphanMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/orphan-urls$/);
  if (method === "GET" && orphanMatch) {
    const page = store.listOrphanUrls(orphanMatch[1], orphanMatch[2], paginationOptions(searchParams));
    return json(200, { data: page.data, meta: pageMeta(page) });
  }

  return null;
};
