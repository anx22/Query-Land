import { appRoutes, demoProject, seoMemory } from "@seo-tool/shared-config";

export function getFoundationState() {
  return {
    memory: seoMemory,
    project: demoProject,
    routeCount: appRoutes.length,
  };
}
