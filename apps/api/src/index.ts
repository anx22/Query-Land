import { appRoutes, demoProject, seoMemory } from "@seo-tool/shared-config";

export function getFoundationState() {
  return {
    memory: seoMemory,
    project: demoProject,
    routeCount: appRoutes.length,
  };
}

export { createApp, handleRequest } from "./app.js";
export { createSQLiteStore, type SQLiteStore, type AuthStore, type ProjectStore, type CrawlStore, type JobStore, type SourceMapStore } from "./sqlite-store.js";
