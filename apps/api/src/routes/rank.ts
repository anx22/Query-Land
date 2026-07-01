import { SERP_DEVICES, type SerpDevice } from "@seo-tool/domain-model";
import { json } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeRank: ResourceRoute = async (store, method, pathname, searchParams, body) => {
  const rankMatch = pathname.match(/^\/projects\/([^/]+)\/keywords\/([^/]+)\/rank-snapshots$/);
  if (rankMatch) {
    if (method === "POST") {
      const input = body && typeof body === "object" && !Array.isArray(body) ? body as { market?: string; device?: SerpDevice } : {};
      const device = input.device && (SERP_DEVICES as readonly string[]).includes(input.device) ? input.device : undefined;
      return json(201, { data: await store.recordRankSnapshot(rankMatch[1], rankMatch[2], { market: typeof input.market === "string" ? input.market : undefined, device }) });
    }
    if (method === "GET") {
      return json(200, { data: await store.listRankSnapshots(rankMatch[1], rankMatch[2]) });
    }
    return null;
  }

  const latestPositionsMatch = pathname.match(/^\/projects\/([^/]+)\/rank-snapshots\/latest$/);
  if (method === "GET" && latestPositionsMatch) {
    return json(200, { data: await store.latestKeywordPositions(latestPositionsMatch[1], searchParams.get("market") ?? undefined) });
  }

  const serpMatch = pathname.match(/^\/projects\/([^/]+)\/keywords\/([^/]+)\/serp-snapshots$/);
  if (method === "GET" && serpMatch) {
    return json(200, { data: await store.listSerpSnapshots(serpMatch[1], serpMatch[2]) });
  }

  const diffMatch = pathname.match(/^\/projects\/([^/]+)\/keywords\/([^/]+)\/serp-diff$/);
  if (method === "GET" && diffMatch) {
    return json(200, { data: await store.serpDiff(diffMatch[1], diffMatch[2]) });
  }

  const visibilityMatch = pathname.match(/^\/projects\/([^/]+)\/visibility$/);
  if (method === "GET" && visibilityMatch) {
    return json(200, { data: await store.listVisibilityScores(visibilityMatch[1], searchParams.get("market") ?? undefined) });
  }

  const computeMatch = pathname.match(/^\/projects\/([^/]+)\/visibility\/compute$/);
  if (method === "POST" && computeMatch) {
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as { market?: string } : {};
    return json(201, { data: await store.computeVisibility(computeMatch[1], typeof input.market === "string" ? input.market : undefined) });
  }

  return null;
};
