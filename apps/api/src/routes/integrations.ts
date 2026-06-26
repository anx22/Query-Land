import { json } from "../http.js";
import { createIntegrationRequest, upsertIntegrationCredentialsRequest } from "../request-validators.js";
import type { ResourceRoute } from "./shared.js";

export const routeIntegrations: ResourceRoute = async (store, method, pathname, _searchParams, body) => {
  // OAuth callback writes exchanged credentials here (create-or-update by project+provider).
  if (method === "POST" && pathname === "/integrations/credentials") {
    const input = upsertIntegrationCredentialsRequest(body);
    return json(200, { data: await store.upsertIntegrationCredentials(input) });
  }

  const scheduleMatch = pathname.match(/^\/integrations\/([^/]+)\/sync\/schedule$/);
  if (method === "POST" && scheduleMatch) {
    const siteId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { siteId?: unknown }).siteId === "string"
      ? (body as { siteId: string }).siteId
      : undefined;
    const result = await store.scheduleConnectorSync(scheduleMatch[1], { siteId });
    return json(result.idempotent ? 200 : 201, { data: result.job, idempotent: result.idempotent });
  }

  const syncMatch = pathname.match(/^\/integrations\/([^/]+)\/sync$/);
  if (method === "POST" && syncMatch) {
    const siteId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { siteId?: unknown }).siteId === "string"
      ? (body as { siteId: string }).siteId
      : undefined;
    return json(200, { data: await store.runConnectorSync(syncMatch[1], { siteId }) });
  }

  // Read-Endpoint für den Connector-Vertrag/Status einer einzelnen Integration
  // (authStatus/quota/freshness/capabilities sowie letzter Sync/Evidence).
  const detailMatch = pathname.match(/^\/integrations\/([^/]+)$/);
  if (method === "GET" && detailMatch) {
    return json(200, { data: await store.getIntegration(detailMatch[1]) });
  }

  if (pathname !== "/integrations") return null;
  if (method === "GET") return json(200, { data: await store.listIntegrations() });
  if (method === "POST") {
    const input = createIntegrationRequest(body);
    return json(201, { data: await store.createIntegration(input.projectId, input.provider) });
  }
  return null;
};
