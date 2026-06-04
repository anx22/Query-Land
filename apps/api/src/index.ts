import { appRoutes, demoProject, seoMemory } from "@seo-tool/shared-config";

export function getFoundationState() {
  return {
    memory: seoMemory,
    project: demoProject,
    routeCount: appRoutes.length,
  };
}

export { createApp, handleRequest } from "./app.js";
export { createSQLiteStore, type BackendStore } from "./sqlite-store.js";
