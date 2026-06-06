import type { OpportunityStatus } from "@seo-tool/domain-model";
import { json, type ApiResponse } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { CreateOpportunityInput } from "../stores/opportunity-store.js";
import { enumQuery, pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

const STATUSES: readonly OpportunityStatus[] = ["open", "planned", "in_progress", "implemented", "validated", "reopened", "dismissed", "expired"];
const TYPES = ["technical_fix", "low_hanging_keyword", "cannibalization", "money_page", "internal_link_gap", "aeo"] as const;

export const routeOpportunities: ResourceRoute = (store, method, pathname, searchParams, body): ApiResponse | null => {
  const collectionMatch = pathname.match(/^\/projects\/([^/]+)\/opportunities$/);
  if (collectionMatch) {
    if (method === "GET") {
      const page = store.listOpportunitiesPage(collectionMatch[1], paginationOptions(searchParams), {
        status: enumQuery(searchParams, "status", STATUSES),
        type: enumQuery(searchParams, "type", TYPES)
      });
      return json(200, { data: page.data, meta: pageMeta(page) });
    }
    if (method === "POST") {
      return json(201, { data: store.createOpportunity(collectionMatch[1], asCreateInput(body)) });
    }
    return null;
  }

  const transitionMatch = pathname.match(/^\/opportunities\/([^/]+)\/transition$/);
  if (method === "POST" && transitionMatch) {
    const status = asObject(body).status;
    if (typeof status !== "string" || !STATUSES.includes(status as OpportunityStatus)) {
      throw new RequestError(400, "invalid_field", `status must be one of ${STATUSES.join(", ")}`);
    }
    return json(200, { data: store.transitionOpportunity(transitionMatch[1], status as OpportunityStatus) });
  }

  const singleMatch = pathname.match(/^\/opportunities\/([^/]+)$/);
  if (method === "GET" && singleMatch) {
    return json(200, { data: store.getOpportunity(singleMatch[1]) });
  }

  return null;
};

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "invalid_body", "Request body must be an object");
  }
  return body as Record<string, unknown>;
}

function asCreateInput(body: unknown): CreateOpportunityInput {
  const input = asObject(body);
  return input as unknown as CreateOpportunityInput;
}
