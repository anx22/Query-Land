import { json } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeUrlInspection: ResourceRoute = async (store, method, pathname, _searchParams, body) => {
  const syncMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/url-inspection\/sync$/);
  if (method === "POST" && syncMatch) {
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as { maxUrls?: number } : {};
    const maxUrls = typeof input.maxUrls === "number" && Number.isFinite(input.maxUrls) ? input.maxUrls : undefined;
    return json(202, { data: await store.syncUrlInspection(syncMatch[1], syncMatch[2], { maxUrls }) });
  }

  const summaryMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/index-status\/summary$/);
  if (method === "GET" && summaryMatch) {
    return json(200, { data: await store.indexStatusSummary(summaryMatch[1], summaryMatch[2]) });
  }

  return null;
};
