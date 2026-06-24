import { KEYWORD_INTENTS, type KeywordIntent } from "@seo-tool/domain-model";
import { json } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { AddKeywordsInput } from "../stores/keyword-store.js";
import { enumQuery, pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

export const routeKeywords: ResourceRoute = async (store, method, pathname, searchParams, body) => {
  const groupsMatch = pathname.match(/^\/projects\/([^/]+)\/keyword-groups$/);
  if (groupsMatch) {
    if (method === "GET") return json(200, { data: await store.listKeywordGroups(groupsMatch[1]) });
    if (method === "POST") {
      const input = asObject(body);
      return json(201, { data: await store.createKeywordGroup(groupsMatch[1], { name: requireString(input.name, "name"), topic: typeof input.topic === "string" ? input.topic : undefined }) });
    }
    return null;
  }

  const keywordsMatch = pathname.match(/^\/projects\/([^/]+)\/keywords$/);
  if (keywordsMatch) {
    if (method === "GET") {
      const brandParam = searchParams.get("brand");
      const page = await store.listKeywordsPage(keywordsMatch[1], paginationOptions(searchParams), {
        groupId: searchParams.get("groupId") ?? undefined,
        intent: enumQuery(searchParams, "intent", KEYWORD_INTENTS as readonly KeywordIntent[]),
        brand: brandParam === null ? undefined : brandParam === "true",
        market: searchParams.get("market") ?? undefined
      });
      return json(200, { data: page.data, meta: pageMeta(page) });
    }
    if (method === "POST") {
      return json(201, { data: await store.addKeywords(keywordsMatch[1], asObject(body) as unknown as AddKeywordsInput) });
    }
    return null;
  }

  const mapMatch = pathname.match(/^\/projects\/([^/]+)\/keywords\/([^/]+)\/map-url$/);
  if (method === "POST" && mapMatch) {
    const input = asObject(body);
    const targetUrl = typeof input.targetUrl === "string" ? input.targetUrl : null;
    return json(200, { data: await store.mapKeywordToUrl(mapMatch[1], mapMatch[2], targetUrl) });
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
