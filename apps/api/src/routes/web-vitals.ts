import { json, type ApiResponse } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeWebVitals: ResourceRoute = (store, method, pathname): ApiResponse | null => {
  const match = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/web-vitals$/);
  if (method === "GET" && match) {
    return json(200, { data: store.listSiteWebVitals(match[1], match[2]) });
  }
  return null;
};
