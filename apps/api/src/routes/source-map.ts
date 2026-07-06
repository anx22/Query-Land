import { json } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { DeployMarkerInput, PrCheckInput, SourceMapUpsertInput } from "../stores/source-map-store.js";
import type { ResourceRoute } from "./shared.js";

export const routeSourceMap: ResourceRoute = async (store, method, pathname, searchParams, body) => {
  if (pathname === "/source-map") {
    if (method === "GET") {
      return json(200, { data: await store.listSourceMapEntries() });
    }
    if (method === "POST") {
      const input = asObject(body);
      const projectId = requireString(input.projectId, "projectId");
      return json(201, { data: await store.upsertSourceMapEntry(projectId, input as unknown as SourceMapUpsertInput) });
    }
    return null;
  }

  if (method === "GET" && pathname === "/source-map/resolve") {
    const url = searchParams.get("url");
    if (!url) {
      throw new RequestError(400, "missing_field", "url query parameter is required");
    }
    return json(200, { data: await store.resolveSourceAnchor(url) });
  }

  const deployMatch = pathname.match(/^\/projects\/([^/]+)\/deploy-markers$/);
  if (deployMatch) {
    if (method === "GET") {
      return json(200, { data: await store.listDeployMarkers(deployMatch[1]) });
    }
    if (method === "POST") {
      const marker = await store.createDeployMarker(deployMatch[1], asObject(body) as unknown as DeployMarkerInput);
      // §4.3: a deploy schedules a source-map refresh; the cron drains it into a re-crawl of the
      // project's sites so the audit reflects the freshly deployed templates.
      await store.createJob(deployMatch[1], "source_map_refresh", `deploy-${marker.id}`, { deployMarkerId: marker.id });
      return json(201, { data: marker });
    }
    return null;
  }

  // WP-3.3: Source-Map Pre-Merge-Gate. POST evaluiert geänderte Repo-Pfade, GET liefert den Verlauf.
  const prCheckMatch = pathname.match(/^\/projects\/([^/]+)\/pr-checks$/);
  if (prCheckMatch) {
    if (method === "GET") {
      return json(200, { data: await store.listPrChecks(prCheckMatch[1]) });
    }
    if (method === "POST") {
      return json(201, { data: await store.evaluatePrCheck(prCheckMatch[1], asObject(body) as unknown as PrCheckInput) });
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
