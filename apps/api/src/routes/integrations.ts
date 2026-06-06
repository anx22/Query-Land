import { json, type ApiResponse } from "../http.js";
import { createIntegrationRequest } from "../request-validators.js";
import type { ResourceRoute } from "./shared.js";

export const routeIntegrations: ResourceRoute = (store, method, pathname, _searchParams, body): ApiResponse | null => {
  if (pathname !== "/integrations") return null;
  if (method === "GET") return json(200, { data: store.listIntegrations() });
  if (method === "POST") {
    const input = createIntegrationRequest(body);
    return json(201, { data: store.createIntegration(input.projectId, input.provider) });
  }
  return null;
};
