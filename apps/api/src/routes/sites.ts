import { json, type ApiResponse } from "../http.js";
import { createSiteRequest } from "../request-validators.js";
import type { ResourceRoute } from "./shared.js";

export const routeSites: ResourceRoute = (store, method, pathname, _searchParams, body): ApiResponse | null => {
  const match = pathname.match(/^\/projects\/([^/]+)\/sites$/);
  if (!match) return null;
  if (method === "GET") return json(200, { data: store.listSites(match[1]) });
  if (method === "POST") return json(201, { data: store.createSite(match[1], createSiteRequest(body)) });
  return null;
};
