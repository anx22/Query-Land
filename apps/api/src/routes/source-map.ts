import { json, type ApiResponse } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { DeployMarkerInput, PrCheckInput, SourceMapUpsertInput } from "../stores/source-map-store.js";
import type { ResourceRoute } from "./shared.js";

export const routeSourceMap: ResourceRoute = (store, method, pathname, searchParams, body): ApiResponse | null => {
  if (pathname === "/source-map") {
    if (method === "GET") {
      return json(200, { data: store.listSourceMapEntries() });
    }
    if (method === "POST") {
      const input = asObject(body);
      const projectId = requireString(input.projectId, "projectId");
      return json(201, { data: store.upsertSourceMapEntry(projectId, input as unknown as SourceMapUpsertInput) });
    }
    return null;
  }

  if (method === "GET" && pathname === "/source-map/resolve") {
    const url = searchParams.get("url");
    if (!url) {
      throw new RequestError(400, "missing_field", "url query parameter is required");
    }
    return json(200, { data: store.resolveSourceAnchor(url) });
  }

  const deployMatch = pathname.match(/^\/projects\/([^/]+)\/deploy-markers$/);
  if (deployMatch) {
    if (method === "GET") {
      return json(200, { data: store.listDeployMarkers(deployMatch[1]) });
    }
    if (method === "POST") {
      return json(201, { data: store.createDeployMarker(deployMatch[1], asObject(body) as unknown as DeployMarkerInput) });
    }
    return null;
  }

  // WP-3.3: Source-Map Pre-Merge-Gate. POST evaluiert geänderte Repo-Pfade, GET liefert den Verlauf.
  const prCheckMatch = pathname.match(/^\/projects\/([^/]+)\/pr-checks$/);
  if (prCheckMatch) {
    if (method === "GET") {
      return json(200, { data: store.listPrChecks(prCheckMatch[1]) });
    }
    if (method === "POST") {
      return json(201, { data: store.evaluatePrCheck(prCheckMatch[1], asObject(body) as unknown as PrCheckInput) });
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

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RequestError(400, "missing_field", `${field} is required`);
  }
  return value;
}
