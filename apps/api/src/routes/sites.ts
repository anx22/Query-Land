import { json } from "../http.js";
import { createSiteRequest } from "../request-validators.js";
import type { ResourceRoute } from "./shared.js";

export const routeSites: ResourceRoute = async (store, method, pathname, _searchParams, body) => {
  const match = pathname.match(/^\/projects\/([^/]+)\/sites$/);
  if (!match) return null;
  if (method === "GET") return json(200, { data: await store.listSites(match[1]) });
  if (method === "POST") return json(201, { data: await store.createSite(match[1], createSiteRequest(body)) });
  return null;
};
