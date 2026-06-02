import type { IntegrationAccount, JobRun, Opportunity, Project, SeoMemorySnapshot, SourceTemplateMap } from "@seo/domain-model";

export interface AppRoute {
  label: string;
  href: string;
  icon: string;
  description: string;
  wave: number;
}

export const appRoutes: AppRoute[] = [
  { label: "Overview", href: "/", icon: "dashboard", description: "Projekt-KPIs, Risiken und nächste Maßnahmen", wave: 1 },
  { label: "Projects", href: "/projects", icon: "folder", description: "Scopes, Märkte, Wettbewerber und Business-Werte", wave: 1 },
  { label: "Technical Audit", href: "/technical-audit", icon: "troubleshoot", description: "Crawls, Issues, Health Score und URL Explorer", wave: 2 },
  { label: "Keywords & Rank", href: "/keywords-rank", icon: "key", description: "Keyword-Sets, Rankings, SERP-Diffs und Visibility", wave: 3 },
  { label: "Content & Opportunities", href: "/content-opportunities", icon: "lightbulb", description: "Opportunity Board, Briefings und Validierung", wave: 4 },
  { label: "Backlinks", href: "/backlinks", icon: "link", description: "Ref-Domains, Link-Events und Authority Delta", wave: 5 },
  { label: "Reports", href: "/reports", icon: "description", description: "Weekly Pulse, Alerts und Exporte", wave: 6 },
  { label: "AI Visibility", href: "/ai-visibility", icon: "auto_awesome", description: "Prompt-, Citation-, Mention- und Referral-Tracking", wave: 7 },
  { label: "Settings", href: "/settings", icon: "settings", description: "Rollen, Connectors, Quotas und Observability", wave: 1 },
];

export const seoMemory: SeoMemorySnapshot = {
  deliveryWave: "foundation",
  sourceOfTruth: ["DOCS/docs/PRODUCT_MASTER_SPEC.md", "DOCS/docs/UX_FLOWS.md", "DOCS/specs/project-control.md", "DOCS/specs/integrations.md", "DOCS/specs/source-map.md"],
  principles: [
    "First-party before third-party",
    "Action over dashboards",
    "Evidence-first",
    "Source-anchored",
    "Provider abstraction",
    "Raw and normalized data stay separated",
  ],
  foundationGate: ["Domain anlegen", "Crawl starten", "GSC/GA4 verbinden", "Fehler und Jobs sichtbar machen"],
};

export const demoProject: Project = {
  id: "project-owned-web",
  name: "Owned Web Platform",
  description: "Welle-1-Demo für eine eigene Property mit First-Party-Daten und Source-Map-Gerüst.",
  owner: "SEO Ops",
  competitors: ["semrush.com", "ahrefs.com", "similarweb.com"],
  keywordGroups: ["Core Money Keywords", "Technical SEO", "AI Visibility"],
  sites: [
    {
      id: "site-main",
      hostname: "example-owned-site.com",
      pathScope: "/",
      market: { country: "DE", language: "de", device: "desktop", searchEngine: "google" },
    },
  ],
  businessPriorities: [
    { label: "Demo- und Pricing-Seiten", value: 0.95, urlPattern: "/(demo|pricing)" },
    { label: "Editoriale Evergreen-Seiten", value: 0.7, urlPattern: "/blog/*" },
  ],
};

export const demoIntegrations: IntegrationAccount[] = [
  { id: "int-gsc", projectId: demoProject.id, sourceType: "gsc", displayName: "Google Search Console", status: "connected", sourceConfidence: "B", quotaUsed: 18, quotaLimit: 100, lastSyncAt: "2026-06-02T07:45:00Z" },
  { id: "int-ga4", projectId: demoProject.id, sourceType: "ga4", displayName: "GA4 Property", status: "needs_review", sourceConfidence: "A", quotaUsed: 11, quotaLimit: 100, lastSyncAt: "2026-06-01T22:15:00Z" },
  { id: "int-crawler", projectId: demoProject.id, sourceType: "crawler", displayName: "Internal Crawl", status: "connected", sourceConfidence: "A", quotaUsed: 35, quotaLimit: 100, lastSyncAt: "2026-06-02T06:30:00Z" },
];

export const demoJobs: JobRun[] = [
  { id: "job-crawl-001", projectId: demoProject.id, kind: "crawl", status: "succeeded", idempotencyKey: "crawl:project-owned-web:2026-06-02", startedAt: "2026-06-02T06:00:00Z", finishedAt: "2026-06-02T06:30:00Z" },
  { id: "job-gsc-001", projectId: demoProject.id, kind: "gsc_import", status: "running", idempotencyKey: "gsc:project-owned-web:2026-06-02", startedAt: "2026-06-02T07:45:00Z" },
  { id: "job-source-map-001", projectId: demoProject.id, kind: "source_map", status: "queued", idempotencyKey: "source-map:project-owned-web:main" },
];

export const demoSourceMap: SourceTemplateMap[] = [
  { id: "map-home", routePattern: "/", templateName: "HomeTemplate", repositoryPath: "apps/web/src/app/page.tsx", confidence: "exact", lastVerifiedAt: "2026-06-02T06:35:00Z" },
  { id: "map-pricing", routePattern: "/pricing", templateName: "PricingTemplate", repositoryPath: "apps/web/src/app/(marketing)/pricing/page.tsx", confidence: "heuristic", lastVerifiedAt: "2026-06-02T06:35:00Z" },
];

export const demoOpportunities: Opportunity[] = [
  {
    id: "opp-indexability-001",
    projectId: demoProject.id,
    type: "technical_fix",
    affectedUrls: ["https://example-owned-site.com/pricing"],
    affectedKeywords: ["seo operating system"],
    affectedClusters: ["Core Money Keywords"],
    sourceAnchor: { repositoryPath: "apps/web/src/app/(marketing)/pricing/page.tsx", templateName: "PricingTemplate", confidence: "heuristic" },
    evidence: [{ source: "Internal Crawl", sourceConfidence: "A", metric: "indexability", beforeValue: "blocked", currentValue: "noindex", timeWindow: "latest crawl", affectedEntity: "/pricing" }],
    currentState: "Pricing-Seite ist crawlbar, trägt aber noindex.",
    recommendedAction: "Noindex im Pricing-Template entfernen und nach Deploy einen Re-Crawl schedulen.",
    expectedImpact: 0.8,
    effort: 0.25,
    confidence: 0.9,
    businessValue: 0.95,
    urgency: 0.8,
    priority: 219,
    validationMetric: "Crawl-Recheck: indexable=true und URL Inspection ohne Blocker.",
    owner: "SEO Ops",
    status: "open",
    createdAt: "2026-06-02T08:00:00Z",
    updatedAt: "2026-06-02T08:00:00Z",
    expiresAt: "2026-07-02T08:00:00Z",
  },
];
export const stackDecision = {
  frontend: "Next.js/React",
  api: "TypeScript Node HTTP API",
  database: "SQLite embedded for local/Codex execution; Postgres remains the scale-out migration target",
  jobSystem: "SQLite-backed queue locally; same contract can migrate to Postgres-backed queue when scale requires it",
  auth: "Backend-owned email/password sessions stored in the embedded database"
} as const;

export const apiDefaults = {
  port: Number.parseInt(process.env.API_PORT ?? "4000", 10),
  version: "0.2.0-sqlite-auth",
  databaseUrl: process.env.DATABASE_URL ?? "sqlite:data/seo-os.sqlite"
} as const;
