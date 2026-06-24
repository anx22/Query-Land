import { json } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { ResourceRoute } from "./shared.js";

// WP-6.1/6.2: AI Visibility (LLM-Stub, Klasse E — Signal, keine Evidenz) + AEO-Scan (Klasse A).
export const routeAi: ResourceRoute = async (store, method, pathname, _searchParams, body) => {
  const snapshotMatch = pathname.match(/^\/projects\/([^/]+)\/ai-prompts\/([^/]+)\/snapshots$/);
  if (snapshotMatch) {
    if (method === "POST") {
      return json(202, { data: await store.recordAiSnapshot(snapshotMatch[1], snapshotMatch[2]) });
    }
    if (method === "GET") {
      return json(200, { data: await store.listAiSnapshots(snapshotMatch[1], snapshotMatch[2]) });
    }
    return null;
  }

  const promptsMatch = pathname.match(/^\/projects\/([^/]+)\/ai-prompts$/);
  if (promptsMatch) {
    if (method === "GET") {
      return json(200, { data: await store.listAiPrompts(promptsMatch[1]) });
    }
    if (method === "POST") {
      const input = asObject(body);
      return json(201, { data: await store.createAiPrompt(promptsMatch[1], { prompt: String(input.prompt ?? ""), market: typeof input.market === "string" ? input.market : undefined }) });
    }
    return null;
  }

  const visibilityMatch = pathname.match(/^\/projects\/([^/]+)\/ai-visibility$/);
  if (method === "GET" && visibilityMatch) {
    return json(200, { data: await store.aiVisibilityScore(visibilityMatch[1]) });
  }

  const aeoScanMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/aeo\/scan$/);
  if (method === "POST" && aeoScanMatch) {
    const input = asObject(body);
    return json(201, { data: await store.scanAeo(aeoScanMatch[1], aeoScanMatch[2], { url: String(input.url ?? ""), content: String(input.content ?? "") }) });
  }

  const aeoListMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/aeo$/);
  if (method === "GET" && aeoListMatch) {
    return json(200, { data: await store.listAeoAssessments(aeoListMatch[1], aeoListMatch[2]) });
  }

  return null;
};

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "invalid_body", "Request body must be an object");
  }
  return body as Record<string, unknown>;
}
