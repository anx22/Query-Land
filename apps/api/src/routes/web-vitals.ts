import { json } from "../http.js";
import type { ResourceRoute } from "./shared.js";

export const routeWebVitals: ResourceRoute = async (store, method, pathname) => {
  const match = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/web-vitals$/);
  if (method === "GET" && match) {
    return json(200, { data: await store.listSiteWebVitals(match[1], match[2]) });
  }
  // Evaluate the latest Core Web Vitals into audit issues (lcp_slow/cls_high/inp_slow/ttfb_slow) and
  // recompute health. Called by the cron after a PSI connector sync persists fresh vitals.
  const evaluateMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/web-vitals\/evaluate$/);
  if (method === "POST" && evaluateMatch) {
    return json(201, { data: await store.evaluateWebVitalIssues(evaluateMatch[1], evaluateMatch[2]) });
  }
  return null;
};
