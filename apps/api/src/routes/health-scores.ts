import { json, type ApiResponse } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeHealthScores: ResourceRoute = (store, method, pathname): ApiResponse | null => {
  const listMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/health-scores$/);
  if (method === "GET" && listMatch) {
    return json(200, { data: store.listHealthScores(listMatch[1], listMatch[2]) });
  }
  const computeMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/health-scores\/compute$/);
  if (method === "POST" && computeMatch) {
    return json(201, { data: store.computeHealthScore(computeMatch[1], computeMatch[2]) });
  }
  return null;
};
