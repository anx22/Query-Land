import type { ContentRecommendationStatus } from "@seo-tool/domain-model";
import { CONTENT_RECOMMENDATION_STATUSES } from "@seo-tool/domain-model";
import { json } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { BriefToProposalInput, CreateContentRecommendationInput, PageMetricInput, UpdateContentRecommendationInput } from "../stores/content-store.js";
import { enumQuery, type ResourceRoute } from "./shared.js";

// UX7-W1: Content Workspace. Refresh-centric, MANUAL brief (no LLM auto-generation). Metrics are
// derived from real GSC search-performance data (class B) when connected, honest-empty otherwise —
// not demo stubs. Briefs bridge into the proposal/MCP rail via /create-proposal.
export const routeContent: ResourceRoute = async (store, method, pathname, searchParams, body) => {
  // POST /content-recommendations/:id/transition
  const transitionMatch = pathname.match(/^\/content-recommendations\/([^/]+)\/transition$/);
  if (method === "POST" && transitionMatch) {
    const status = asObject(body).status;
    if (typeof status !== "string" || !CONTENT_RECOMMENDATION_STATUSES.includes(status as ContentRecommendationStatus)) {
      throw new RequestError(400, "invalid_field", `status must be one of ${CONTENT_RECOMMENDATION_STATUSES.join(", ")}`);
    }
    return json(200, { data: await store.transitionContentRecommendation(transitionMatch[1], status as ContentRecommendationStatus) });
  }

  // POST /content-recommendations/:id/create-proposal — brief -> proposal bridge.
  const proposalMatch = pathname.match(/^\/content-recommendations\/([^/]+)\/create-proposal$/);
  if (method === "POST" && proposalMatch) {
    return json(201, { data: await store.createProposalFromBrief(proposalMatch[1], asObject(body) as unknown as BriefToProposalInput) });
  }

  // GET/PATCH /content-recommendations/:id
  const singleMatch = pathname.match(/^\/content-recommendations\/([^/]+)$/);
  if (singleMatch) {
    if (method === "GET") {
      return json(200, { data: await store.getContentRecommendation(singleMatch[1]) });
    }
    if (method === "PATCH") {
      return json(200, { data: await store.updateContentRecommendation(singleMatch[1], asObject(body) as unknown as UpdateContentRecommendationInput) });
    }
    return null;
  }

  // GET/POST /projects/:projectId/sites/:siteId/content-recommendations
  const collectionMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/content-recommendations$/);
  if (collectionMatch) {
    if (method === "GET") {
      return json(200, {
        data: await store.listContentRecommendations(collectionMatch[1], collectionMatch[2], {
          status: enumQuery(searchParams, "status", CONTENT_RECOMMENDATION_STATUSES)
        })
      });
    }
    if (method === "POST") {
      return json(201, { data: await store.createContentRecommendation(collectionMatch[1], collectionMatch[2], asObject(body) as unknown as CreateContentRecommendationInput) });
    }
    return null;
  }

  // GET/POST /projects/:projectId/sites/:siteId/page-metrics
  const metricsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/page-metrics$/);
  if (metricsMatch) {
    if (method === "GET") {
      return json(200, { data: await store.listPageMetrics(metricsMatch[1], metricsMatch[2], searchParams.get("url") ?? undefined) });
    }
    if (method === "POST") {
      const metrics = asObject(body).metrics as PageMetricInput[];
      return json(201, { data: await store.recordPageMetrics(metricsMatch[1], metricsMatch[2], metrics) });
    }
    return null;
  }

  // GET /projects/:projectId/sites/:siteId/refresh-candidates
  const refreshMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/refresh-candidates$/);
  if (method === "GET" && refreshMatch) {
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw && Number.isInteger(Number(limitRaw)) ? Number(limitRaw) : undefined;
    return json(200, { data: await store.listRefreshCandidates(refreshMatch[1], refreshMatch[2], { limit }) });
  }

  // GET /projects/:projectId/sites/:siteId/content-score?url=...
  const scoreMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/content-score$/);
  if (method === "GET" && scoreMatch) {
    const url = searchParams.get("url");
    if (!url) throw new RequestError(400, "missing_field", "url query parameter is required");
    return json(200, { data: await store.contentScore(scoreMatch[1], scoreMatch[2], url) });
  }

  // GET /projects/:projectId/sites/:siteId/internal-link-suggestions?url=...
  const suggestMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/internal-link-suggestions$/);
  if (method === "GET" && suggestMatch) {
    const url = searchParams.get("url");
    if (!url) throw new RequestError(400, "missing_field", "url query parameter is required");
    return json(200, { data: await store.suggestInternalLinks(suggestMatch[1], suggestMatch[2], url) });
  }

  return null;
};

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "invalid_body", "Request body must be an object");
  }
  return body as Record<string, unknown>;
}
