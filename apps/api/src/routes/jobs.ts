import type { FoundationJob } from "@seo-tool/domain-model";
import { json } from "../http.js";
import { createJobRequest, completeJobRequest } from "../request-validators.js";
import type { ResourceRoute } from "./shared.js";

export const routeJobs: ResourceRoute = async (store, method, pathname, _searchParams, body) => {
  if (pathname === "/jobs") {
    if (method === "GET") return json(200, { data: await store.listJobs() });
    if (method === "POST") {
      const input = createJobRequest(body);
      const result = await store.createJob(input.projectId, input.type, input.subject, input.payload);
      return json(result.idempotent ? 200 : 201, { data: result.job, idempotent: result.idempotent });
    }
    return null;
  }

  if (method === "POST" && pathname === "/jobs/claim") {
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as { type?: FoundationJob["type"] } : {};
    return json(200, { data: await store.claimNextJob(input.type) });
  }

  const completeMatch = pathname.match(/^\/jobs\/([^/]+)\/complete$/);
  if (method === "POST" && completeMatch) {
    const input = completeJobRequest(body);
    return json(200, { data: await store.completeJob(completeMatch[1], input.status, input.lastError) });
  }

  return null;
};
