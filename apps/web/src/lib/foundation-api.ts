import { apiDefaults } from "@seo-tool/shared-config";
import type { AuditIssueRecord, CrawlHealthScore, CrawlRun, DiscoveredUrl } from "@seo-tool/domain-model";

export interface FoundationProject {
  id: string;
  name: string;
  slug: string;
  status: string;
  defaultLocale: string;
}

export interface FoundationSite {
  id: string;
  projectId: string;
  baseUrl: string;
  scopeType: string;
  crawlFrequency: string;
  businessValue: number;
}

export interface FoundationIntegration {
  id: string;
  projectId: string;
  provider: string;
  status: string;
  sourceConfidence: string;
  freshness: string | null;
}

export interface FoundationJob {
  id: string;
  projectId: string;
  type: string;
  status: string;
  idempotencyKey: string;
  subject: string;
  payload: Record<string, unknown>;
  attempts: number;
  updatedAt: string;
}

export interface FoundationSourceMapEntry {
  id: string;
  projectId: string;
  urlPattern: string;
  template: string;
  component: string;
  repoPath: string;
  confidence: string;
}

export interface FoundationDashboardData {
  apiBaseUrl: string;
  connected: boolean;
  errorMessage?: string;
  projects: FoundationProject[];
  selectedProject: FoundationProject | null;
  sites: FoundationSite[];
  integrations: FoundationIntegration[];
  jobs: FoundationJob[];
  sourceMap: FoundationSourceMapEntry[];
}


export interface ProjectControlData extends FoundationDashboardData {
  projectSites: Array<{ project: FoundationProject; sites: FoundationSite[] }>;
}

export interface CreateFoundationProjectInput {
  name: string;
  slug: string;
  status?: string;
  defaultLocale?: string;
}

export interface CreateFoundationSiteInput {
  baseUrl: string;
  scopeType: string;
  crawlFrequency?: string;
  businessValue?: number;
}

export interface CreateFoundationIntegrationInput {
  projectId: string;
  provider: string;
}

export interface CreateFoundationJobInput {
  projectId: string;
  type: string;
  subject: string;
  payload?: Record<string, unknown>;
}

export interface TechnicalAuditData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  crawlRuns: CrawlRun[];
  healthScores: CrawlHealthScore[];
  auditIssues: AuditIssueRecord[];
  discoveredUrls: DiscoveredUrl[];
}

interface ApiEnvelope<T> {
  data: T;
}

const apiBaseUrl = process.env.SEO_API_BASE_URL ?? `http://localhost:${apiDefaults.port}`;

export async function loadFoundationDashboardData(): Promise<FoundationDashboardData> {
  try {
    const projects = await apiGet<FoundationProject[]>("/projects");
    const selectedProject = projects[0] ?? null;
    const [sites, integrations, jobs, sourceMap] = await Promise.all([
      selectedProject ? apiGet<FoundationSite[]>(`/projects/${selectedProject.id}/sites`) : Promise.resolve([]),
      apiGet<FoundationIntegration[]>("/integrations"),
      apiGet<FoundationJob[]>("/jobs"),
      apiGet<FoundationSourceMapEntry[]>("/source-map")
    ]);

    return {
      apiBaseUrl,
      connected: true,
      projects,
      selectedProject,
      sites,
      integrations,
      jobs,
      sourceMap
    };
  } catch (error) {
    return {
      apiBaseUrl,
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Foundation API ist nicht erreichbar.",
      projects: [],
      selectedProject: null,
      sites: [],
      integrations: [],
      jobs: [],
      sourceMap: []
    };
  }
}

export async function loadProjectControlData(): Promise<ProjectControlData> {
  const dashboard = await loadFoundationDashboardData();
  if (!dashboard.connected) {
    return { ...dashboard, projectSites: [] };
  }

  try {
    const projectSites = await Promise.all(dashboard.projects.map(async (project) => ({
      project,
      sites: await apiGet<FoundationSite[]>(`/projects/${project.id}/sites`)
    })));
    return { ...dashboard, projectSites };
  } catch (error) {
    return {
      ...dashboard,
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Projekt-/Site-Daten konnten nicht geladen werden.",
      projectSites: []
    };
  }
}

export async function loadTechnicalAuditData(): Promise<TechnicalAuditData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;
  if (!dashboard.connected || !dashboard.selectedProject || !selectedSite) {
    return { ...dashboard, selectedSite, crawlRuns: [], healthScores: [], auditIssues: [], discoveredUrls: [] };
  }

  try {
    const base = `/projects/${dashboard.selectedProject.id}/sites/${selectedSite.id}`;
    const [crawlRuns, healthScores, auditIssues, discoveredUrls] = await Promise.all([
      apiGet<CrawlRun[]>(`${base}/crawl-runs`),
      apiGet<CrawlHealthScore[]>(`${base}/health-scores`),
      apiGet<AuditIssueRecord[]>(`${base}/audit-issues`),
      apiGet<DiscoveredUrl[]>(`${base}/discovered-urls`)
    ]);

    return { ...dashboard, selectedSite, crawlRuns, healthScores, auditIssues, discoveredUrls };
  } catch (error) {
    return {
      ...dashboard,
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Technical-Audit-Daten konnten nicht geladen werden.",
      selectedSite,
      crawlRuns: [],
      healthScores: [],
      auditIssues: [],
      discoveredUrls: []
    };
  }
}

export async function createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): Promise<CrawlRun> {
  return apiPost<CrawlRun>(`/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger });
}

export async function computeCrawlHealthScore(projectId: string, siteId: string): Promise<CrawlHealthScore> {
  return apiPost<CrawlHealthScore>(`/projects/${projectId}/sites/${siteId}/health-scores/compute`, {});
}

export async function createFoundationProject(input: CreateFoundationProjectInput): Promise<FoundationProject> {
  return apiPost<FoundationProject>("/projects", input);
}

export async function createFoundationSite(projectId: string, input: CreateFoundationSiteInput): Promise<FoundationSite> {
  return apiPost<FoundationSite>(`/projects/${projectId}/sites`, input);
}

export async function createFoundationIntegration(input: CreateFoundationIntegrationInput): Promise<FoundationIntegration> {
  return apiPost<FoundationIntegration>("/integrations", input);
}

export async function createFoundationJob(input: CreateFoundationJobInput): Promise<FoundationJob> {
  return apiPost<FoundationJob>("/jobs", input);
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  const payload = await response.json() as ApiEnvelope<T> | T;
  if (isEnvelope<T>(payload)) {
    return payload.data;
  }
  return payload;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as (ApiEnvelope<T> & { error?: { message?: string } }) | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
  }
  if (payload && isEnvelope<T>(payload)) {
    return payload.data;
  }
  throw new Error(`POST ${path} returned an invalid response`);
}

function isEnvelope<T>(payload: ApiEnvelope<T> | T): payload is ApiEnvelope<T> {
  return Boolean(payload && typeof payload === "object" && "data" in payload);
}
