import { json } from "../http.js";
import { createIntegrationRequest } from "../request-validators.js";
import type { ResourceRoute } from "./shared.js";

export const routeIntegrations: ResourceRoute = async (store, method, pathname, _searchParams, body) => {
  const syncMatch = pathname.match(/^\/integrations\/([^/]+)\/sync$/);
  if (method === "POST" && syncMatch) {
    const siteId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { siteId?: unknown }).siteId === "string"
      ? (body as { siteId: string }).siteId
      : undefined;
    return json(200, { data: await store.runConnectorSync(syncMatch[1], { siteId }) });
  }

  if (pathname !== "/integrations") return null;
  if (method === "GET") return json(200, { data: await store.listIntegrations() });
  if (method === "POST") {
    const input = createIntegrationRequest(body);
    return json(201, { data: await store.createIntegration(input.projectId, input.provider) });
  }
  return null;
};
