import { createCrawlSeedJobInput } from "@seo-tool/domain-model";
import { json } from "../http.js";
import { completeCrawlRunRequest, createCrawlRunRequest, scheduleCrawlSeedRequest } from "../request-validators.js";
import { enumQuery, pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

export const routeCrawlRuns: ResourceRoute = async (store, method, pathname, searchParams, body) => {
  const crawlRunsMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/crawl-runs$/);
  if (crawlRunsMatch) {
    if (method === "GET") {
      const page = await store.listCrawlRunsPage(crawlRunsMatch[1], crawlRunsMatch[2], paginationOptions(searchParams), { status: enumQuery(searchParams, "status", ["running", "succeeded", "failed"]) });
      return json(200, { data: page.data, meta: pageMeta(page) });
    }
    if (method === "POST") {
      const input = createCrawlRunRequest(body);
      return json(201, { data: await store.createCrawlRun(crawlRunsMatch[1], crawlRunsMatch[2], input.trigger) });
    }
    return null;
  }

  const scheduleMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/crawl-runs\/schedule$/);
  if (method === "POST" && scheduleMatch) {
    const input = scheduleCrawlSeedRequest(body);
    const crawlRun = await store.createCrawlRun(scheduleMatch[1], scheduleMatch[2], input.trigger);
    const crawlSeedJob = createCrawlSeedJobInput({ siteId: scheduleMatch[2], baseUrl: input.baseUrl, crawlRunId: crawlRun.id, sitemapUrl: input.sitemapUrl });
    const result = await store.createJob(scheduleMatch[1], crawlSeedJob.type, crawlSeedJob.subject, { ...crawlSeedJob.payload });
    return json(result.idempotent ? 200 : 201, { data: { crawlRun, job: result.job }, idempotent: result.idempotent });
  }

  const completeMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/crawl-runs\/([^/]+)\/complete$/);
  if (method === "POST" && completeMatch) {
    const input = completeCrawlRunRequest(body);
    return json(200, { data: await store.completeCrawlRun(completeMatch[1], completeMatch[2], completeMatch[3], input.status, input.errorMessage) });
  }

  return null;
};
