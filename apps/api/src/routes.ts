import { apiError, type ApiResponse } from "./http.js";
import { routeAuditIssues } from "./routes/audit-issues.js";
import { routeCrawlRuns } from "./routes/crawl-runs.js";
import { routeDiscoveredUrls } from "./routes/discovered-urls.js";
import { routeHealthScores } from "./routes/health-scores.js";
import { routeIntegrations } from "./routes/integrations.js";
import { routeInternalLinks } from "./routes/internal-links.js";
import { routeJobs } from "./routes/jobs.js";
import { routeKeywords } from "./routes/keywords.js";
import { routeOpportunities } from "./routes/opportunities.js";
import { routeRank } from "./routes/rank.js";
import { routeSearchPerformance } from "./routes/search-performance.js";
import { routeSites } from "./routes/sites.js";
import { routeSourceMap } from "./routes/source-map.js";
import { routeWebVitals } from "./routes/web-vitals.js";
import type { ProjectChildStore, ResourceRoute } from "./routes/shared.js";

export type { ProjectChildStore } from "./routes/shared.js";

// Ressourcen-Router werden der Reihe nach geprüft; der erste, der den Pfad bedient,
// gewinnt. Die Pfad-Regexe sind disjunkt, daher ist die Reihenfolge unkritisch.
const resourceRoutes: ResourceRoute[] = [
  routeSites,
  routeCrawlRuns,
  routeHealthScores,
  routeAuditIssues,
  routeDiscoveredUrls,
  routeInternalLinks,
  routeWebVitals,
  routeOpportunities,
  routeKeywords,
  routeRank,
  routeSearchPerformance,
  routeIntegrations,
  routeJobs,
  routeSourceMap
];

export async function routeProjectChildren(store: ProjectChildStore, method: string, pathname: string, searchParams: URLSearchParams, body: unknown, requestId: string): Promise<ApiResponse> {
  for (const route of resourceRoutes) {
    const response = route(store, method, pathname, searchParams, body);
    if (response) return response;
  }
  return apiError(404, "not_found", "Route not found", requestId);
}
