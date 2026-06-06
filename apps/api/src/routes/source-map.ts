import { json, type ApiResponse } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeSourceMap: ResourceRoute = (store, method, pathname): ApiResponse | null => {
  if (method === "GET" && pathname === "/source-map") {
    return json(200, { data: store.listSourceMapEntries() });
  }
  return null;
};
