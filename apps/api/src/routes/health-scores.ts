import { json } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeHealthScores: ResourceRoute = async (store, method, pathname) => {
  const listMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/health-scores$/);
  if (method === "GET" && listMatch) {
    return json(200, { data: await store.listHealthScores(listMatch[1], listMatch[2]) });
  }
  const computeMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/health-scores\/compute$/);
  if (method === "POST" && computeMatch) {
    return json(201, { data: await store.computeHealthScore(computeMatch[1], computeMatch[2]) });
  }
  return null;
};
