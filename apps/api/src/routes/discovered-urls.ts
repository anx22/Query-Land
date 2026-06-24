import { json } from "../http.js";
import { recordDiscoveredUrlsRequest, recordFetchResultRequest, recordIndexabilityRequest } from "../request-validators.js";
import { enumQuery, pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

const fetchStatusFilter = ["success", "redirect", "client_error", "server_error", "network_error"] as const;
const sourceFilter = ["seed", "sitemap", "link"] as const;

export const routeDiscoveredUrls: ResourceRoute = async (store, method, pathname, searchParams, body) => {
  const listMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls$/);
  if (listMatch) {
    if (method === "GET") {
      const page = await store.listDiscoveredUrlsPage(listMatch[1], listMatch[2], paginationOptions(searchParams), {
        status: enumQuery(searchParams, "status", fetchStatusFilter),
        source: enumQuery(searchParams, "source", sourceFilter)
      });
      return json(200, { data: page.data, meta: pageMeta(page) });
    }
    if (method === "POST") {
      const input = recordDiscoveredUrlsRequest(body);
      const result = await store.recordDiscoveredUrls(listMatch[1], listMatch[2], input.urls);
      return json(201, { data: result.urls, meta: { inserted: result.inserted, updated: result.updated } });
    }
    return null;
  }

  const explorerMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/url-explorer$/);
  if (method === "GET" && explorerMatch) {
    const page = await store.listUrlExplorerRows(explorerMatch[1], explorerMatch[2], paginationOptions(searchParams), {
      status: enumQuery(searchParams, "status", fetchStatusFilter),
      source: enumQuery(searchParams, "source", sourceFilter)
    });
    return json(200, { data: page.data, meta: pageMeta(page) });
  }

  const fetchResultsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls\/([^/]+)\/fetch-results$/);
  if (fetchResultsMatch) {
    if (method === "GET") return json(200, { data: await store.listFetchResults(fetchResultsMatch[1], fetchResultsMatch[2], fetchResultsMatch[3]) });
    if (method === "POST") return json(201, { data: await store.recordFetchResult(fetchResultsMatch[1], fetchResultsMatch[2], fetchResultsMatch[3], recordFetchResultRequest(body)) });
    return null;
  }

  const indexabilityMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/discovered-urls\/([^/]+)\/indexability$/);
  if (indexabilityMatch) {
    if (method === "GET") return json(200, { data: await store.listIndexabilityAssessments(indexabilityMatch[1], indexabilityMatch[2], indexabilityMatch[3]) });
    if (method === "POST") return json(201, { data: await store.recordIndexabilityAssessment(indexabilityMatch[1], indexabilityMatch[2], indexabilityMatch[3], recordIndexabilityRequest(body)) });
    return null;
  }

  return null;
};
