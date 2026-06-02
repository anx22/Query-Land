import { NextResponse } from "next/server";
import { appRoutes, demoIntegrations, demoJobs, demoOpportunities, demoProject, demoSourceMap, seoMemory } from "@seo/shared-config";

export function GET() {
  return NextResponse.json({
    memory: seoMemory,
    routes: appRoutes,
    project: demoProject,
    integrations: demoIntegrations,
    jobs: demoJobs,
    sourceMap: demoSourceMap,
    opportunities: demoOpportunities,
  });
}
