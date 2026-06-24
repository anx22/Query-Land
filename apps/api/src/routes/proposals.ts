import type { ProposalStatus } from "@seo-tool/domain-model";
import { json } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { CreateProposalInput } from "../stores/proposal-store.js";
import type { ResourceRoute } from "./shared.js";

// WP-6.3: Proposals — reviewpflichtige Artefakte der MCP-Schreibtools (§4.4). Nie Produktiv-Mutation.
export const routeProposals: ResourceRoute = async (store, method, pathname, _searchParams, body) => {
  const transitionMatch = pathname.match(/^\/proposals\/([^/]+)\/transition$/);
  if (method === "POST" && transitionMatch) {
    const status = asObject(body).status;
    return json(200, { data: await store.transitionProposal(transitionMatch[1], String(status) as ProposalStatus) });
  }

  const collectionMatch = pathname.match(/^\/projects\/([^/]+)\/proposals$/);
  if (collectionMatch) {
    if (method === "GET") {
      return json(200, { data: await store.listProposals(collectionMatch[1]) });
    }
    if (method === "POST") {
      return json(201, { data: await store.createProposal(collectionMatch[1], asObject(body) as unknown as CreateProposalInput) });
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
