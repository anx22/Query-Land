import { json } from "../http.js";
import { pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

// WP-3.1: GSC-getriebene Search-Performance-Intelligence je Site. sync schreibt eine neue
// Charge (Klasse B), GET liefert die neueste Charge bzw. die abgeleiteten Gap-Analysen.
export const routeSearchPerformance: ResourceRoute = async (store, method, pathname, searchParams) => {
  const syncMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/search-performance\/sync$/);
  if (method === "POST" && syncMatch) {
    return json(202, { data: await store.syncSearchPerformance(syncMatch[1], syncMatch[2]) });
  }

  const intelligenceMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/search-performance\/intelligence$/);
  if (method === "GET" && intelligenceMatch) {
    return json(200, { data: await store.searchPerformanceIntelligence(intelligenceMatch[1], intelligenceMatch[2]) });
  }

  const listMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/search-performance$/);
  if (method === "GET" && listMatch) {
    const page = await store.listSearchPerformance(listMatch[1], listMatch[2], paginationOptions(searchParams));
    return json(200, { data: page.data, meta: pageMeta(page) });
  }

  return null;
};
