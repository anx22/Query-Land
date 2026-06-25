import { apiError, type ApiResponse, type RequestContext } from "./http.js";
import { routeAi } from "./routes/ai.js";
import { routeAlerts } from "./routes/alerts.js";
import { routeAuditIssues } from "./routes/audit-issues.js";
import { routeBacklinks } from "./routes/backlinks.js";
import { routeContent } from "./routes/content.js";
import { routeCrawlRuns } from "./routes/crawl-runs.js";
import { routeDiscoveredUrls } from "./routes/discovered-urls.js";
import { routeHealthScores } from "./routes/health-scores.js";
import { routeIntegrations } from "./routes/integrations.js";
import { routeInternalLinks } from "./routes/internal-links.js";
import { routeJobs } from "./routes/jobs.js";
import { routeKeywords } from "./routes/keywords.js";
import { routeOpportunities } from "./routes/opportunities.js";
import { routeProposals } from "./routes/proposals.js";
import { routeRank } from "./routes/rank.js";
import { routeReports } from "./routes/reports.js";
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
  routeBacklinks,
  routeReports,
  routeAlerts,
  routeAi,
  routeProposals,
  routeContent,
  routeIntegrations,
  routeJobs,
  routeSourceMap
];

export async function routeProjectChildren(store: ProjectChildStore, method: string, pathname: string, searchParams: URLSearchParams, body: unknown, requestId: string, context: RequestContext = {}): Promise<ApiResponse> {
  for (const route of resourceRoutes) {
    const response = await route(store, method, pathname, searchParams, body, context);
    if (response) return response;
  }
  return apiError(404, "not_found", "Route not found", requestId);
}
