import { json } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeWebVitals: ResourceRoute = async (store, method, pathname) => {
  const match = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/web-vitals$/);
  if (method === "GET" && match) {
    return json(200, { data: await store.listSiteWebVitals(match[1], match[2]) });
  }
  return null;
};
