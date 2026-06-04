import type { FoundationJob, HealthSnapshot, IntegrationAccount, Project, Site, SourceMapEntry } from "@seo-tool/domain-model";

const now = new Date("2026-06-02T00:00:00.000Z").toISOString();

export const projects: Project[] = [
  {
    id: "proj-demo",
    name: "Demo Property",
    slug: "demo-property",
    status: "active",
    defaultLocale: "de-DE",
    markets: [{ country: "DE", language: "de", device: "desktop", searchEngine: "google" }],
    createdAt: now,
    updatedAt: now
  }
];

export const sites: Site[] = [
  {
    id: "site-demo",
    projectId: "proj-demo",
    scopeType: "domain",
    baseUrl: "https://example.com",
    crawlFrequency: "weekly",
    businessValue: 80
  }
];

export const integrations: IntegrationAccount[] = [
  {
    id: "int-gsc-demo",
    projectId: "proj-demo",
    provider: "gsc",
    status: "pending",
    sourceConfidence: "B",
    quotaRemaining: null,
    freshness: null
  },
  {
    id: "int-ga4-demo",
    projectId: "proj-demo",
    provider: "ga4",
    status: "pending",
    sourceConfidence: "A",
    quotaRemaining: null,
    freshness: null
  }
];

export const jobs: FoundationJob[] = [
  {
    id: "job-source-map-refresh-demo",
    projectId: "proj-demo",
    type: "source_map_refresh",
    status: "queued",
    idempotencyKey: "proj-demo:source_map_refresh:demo-property",
    subject: "demo-property",
    payload: { subject: "demo-property" },
    attempts: 0,
    createdAt: now,
    updatedAt: now
  }
];

export const sourceMapEntries: SourceMapEntry[] = [
  {
    id: "srcmap-home-demo",
    projectId: "proj-demo",
    urlPattern: "/",
    template: "home-page",
    component: "HomePage",
    repoPath: "apps/web/app/page.tsx",
    confidence: "exact"
  }
];

export function healthSnapshot(): HealthSnapshot {
  return {
    status: "ok",
    service: "api",
    version: "0.1.0-foundation",
    checkedAt: new Date().toISOString(),
    checks: [
      { name: "http", status: "ok" },
      { name: "postgres_queue_contract", status: "ok", details: "Foundation schema defines job_queue with idempotency_key." },
      { name: "raw_normalized_contract", status: "ok", details: "Foundation schema separates raw_events and normalized_metrics." }
    ]
  };
}
