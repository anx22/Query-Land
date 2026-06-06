import { json, type ApiResponse } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { AlertRuleInput } from "../stores/alert-store.js";
import type { ResourceRoute } from "./shared.js";

// WP-5.4: Alerts. Schwellwert-Regeln je projektweiter Kennzahl, Auswertung erzeugt Events.
export const routeAlerts: ResourceRoute = (store, method, pathname, _searchParams, body): ApiResponse | null => {
  const evaluateMatch = pathname.match(/^\/projects\/([^/]+)\/alerts\/evaluate$/);
  if (method === "POST" && evaluateMatch) {
    return json(201, { data: store.evaluateAlerts(evaluateMatch[1]) });
  }

  const eventsMatch = pathname.match(/^\/projects\/([^/]+)\/alert-events$/);
  if (method === "GET" && eventsMatch) {
    return json(200, { data: store.listAlertEvents(eventsMatch[1]) });
  }

  const ruleMatch = pathname.match(/^\/projects\/([^/]+)\/alert-rules\/([^/]+)$/);
  if (method === "DELETE" && ruleMatch) {
    return json(200, { data: store.deleteAlertRule(ruleMatch[1], ruleMatch[2]) });
  }

  const rulesMatch = pathname.match(/^\/projects\/([^/]+)\/alert-rules$/);
  if (rulesMatch) {
    if (method === "GET") {
      return json(200, { data: store.listAlertRules(rulesMatch[1]) });
    }
    if (method === "POST") {
      return json(201, { data: store.createAlertRule(rulesMatch[1], asObject(body) as unknown as AlertRuleInput) });
    }
    return null;
  }

  return null;
};

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "invalid_body", "Request body must be an object");
  }
  return body as Record<string, unknown>;
}
