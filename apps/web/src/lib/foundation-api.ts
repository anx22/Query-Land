import type { AuditIssueRecord, CrawlHealthScore, CrawlRun, DiscoveredUrl, IndexabilityRecord, UrlFetchRecord } from "@seo-tool/domain-model";
import { callInternalApi } from "./server-api";

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

export interface TechnicalAuditUrlRow {
  discoveredUrl: DiscoveredUrl;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
}

export interface ListMeta {
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface TechnicalAuditData extends FoundationDashboardData {
  selectedSite: FoundationSite | null;
  crawlRuns: CrawlRun[];
  crawlRunsMeta: ListMeta;
  healthScores: CrawlHealthScore[];
  auditIssues: AuditIssueRecord[];
  auditIssuesMeta: ListMeta;
  discoveredUrls: DiscoveredUrl[];
  discoveredUrlsMeta: ListMeta;
  urlExplorerRows: TechnicalAuditUrlRow[];
  urlExplorerMeta: ListMeta;
}

interface TechnicalAuditLoadOptions {
  issueStatus?: string;
  issueSeverity?: string;
  urlOffset?: number;
}

interface ApiEnvelope<T> {
  data: T;
  meta?: ListMeta;
}

const configuredApiBaseUrl = process.env.SEO_API_BASE_URL;
const apiBaseUrl = configuredApiBaseUrl ?? "/api/backend";

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

export async function loadTechnicalAuditData(options: TechnicalAuditLoadOptions = {}): Promise<TechnicalAuditData> {
  const dashboard = await loadFoundationDashboardData();
  const selectedSite = dashboard.sites[0] ?? null;
  if (!dashboard.connected || !dashboard.selectedProject || !selectedSite) {
    return { ...dashboard, selectedSite, crawlRuns: [], crawlRunsMeta: emptyListMeta(), healthScores: [], auditIssues: [], auditIssuesMeta: emptyListMeta(), discoveredUrls: [], discoveredUrlsMeta: emptyListMeta(), urlExplorerRows: [], urlExplorerMeta: emptyListMeta() };
  }

  try {
    const base = `/projects/${dashboard.selectedProject.id}/sites/${selectedSite.id}`;
    const issueParams = new URLSearchParams({ limit: "25" });
    const normalizedIssueStatus = options.issueStatus && ["open", "resolved", "all"].includes(options.issueStatus) ? options.issueStatus : "open";
    issueParams.set("status", normalizedIssueStatus);
    if (options.issueSeverity && options.issueSeverity !== "all") issueParams.set("severity", options.issueSeverity);
    const urlParams = new URLSearchParams({ limit: "25", offset: String(Math.max(0, Math.trunc(options.urlOffset ?? 0))) });

    const [crawlRunsResponse, healthScores, auditIssuesResponse, discoveredUrlsResponse, urlExplorerResponse] = await Promise.all([
      apiGetEnvelope<CrawlRun[]>(`${base}/crawl-runs?limit=10`),
      apiGet<CrawlHealthScore[]>(`${base}/health-scores`),
      apiGetEnvelope<AuditIssueRecord[]>(`${base}/audit-issues?${issueParams.toString()}`),
      apiGetEnvelope<DiscoveredUrl[]>(`${base}/discovered-urls?limit=25`),
      apiGetEnvelope<TechnicalAuditUrlRow[]>(`${base}/url-explorer?${urlParams.toString()}`)
    ]);

    return {
      ...dashboard,
      selectedSite,
      crawlRuns: crawlRunsResponse.data,
      crawlRunsMeta: crawlRunsResponse.meta ?? emptyListMeta(crawlRunsResponse.data.length),
      healthScores,
      auditIssues: auditIssuesResponse.data,
      auditIssuesMeta: auditIssuesResponse.meta ?? emptyListMeta(auditIssuesResponse.data.length),
      discoveredUrls: discoveredUrlsResponse.data,
      discoveredUrlsMeta: discoveredUrlsResponse.meta ?? emptyListMeta(discoveredUrlsResponse.data.length),
      urlExplorerRows: urlExplorerResponse.data,
      urlExplorerMeta: urlExplorerResponse.meta ?? emptyListMeta(urlExplorerResponse.data.length)
    };
  } catch (error) {
    return {
      ...dashboard,
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Technical-Audit-Daten konnten nicht geladen werden.",
      selectedSite,
      crawlRuns: [],
      crawlRunsMeta: emptyListMeta(),
      healthScores: [],
      auditIssues: [],
      auditIssuesMeta: emptyListMeta(),
      discoveredUrls: [],
      discoveredUrlsMeta: emptyListMeta(),
      urlExplorerRows: [],
      urlExplorerMeta: emptyListMeta()
    };
  }
}

function emptyListMeta(total = 0): ListMeta {
  return { limit: total, offset: 0, total, nextCursor: null };
}

export async function createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): Promise<CrawlRun> {
  return apiPost<CrawlRun>(`/projects/${projectId}/sites/${siteId}/crawl-runs`, { trigger });
}

export async function computeCrawlHealthScore(projectId: string, siteId: string): Promise<CrawlHealthScore> {
  return apiPost<CrawlHealthScore>(`/projects/${projectId}/sites/${siteId}/health-scores/compute`, {});
}

export async function resolveAuditIssue(projectId: string, siteId: string, issueId: string): Promise<AuditIssueRecord> {
  return apiPost<AuditIssueRecord>(`/projects/${projectId}/sites/${siteId}/audit-issues/${issueId}/resolve`, {});
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
  return (await apiGetEnvelope<T>(path)).data;
}

async function apiGetEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  if (!configuredApiBaseUrl) {
    const response = await callInternalApi("GET", path);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`GET ${path} failed with ${response.status}`);
    }
    return normalizeEnvelope<T>(response.body);
  }

  const response = await fetch(new URL(path, configuredApiBaseUrl), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return normalizeEnvelope<T>(await response.json() as ApiEnvelope<T> | T);
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (!configuredApiBaseUrl) {
    const response = await callInternalApi("POST", path, body);
    if (response.status < 200 || response.status >= 300) {
      const payload = response.body as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
    }
    return unwrapEnvelope<T>(response.body);
  }

  const response = await fetch(new URL(path, configuredApiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as (ApiEnvelope<T> & { error?: { message?: string } }) | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
  }
  if (payload) {
    return unwrapEnvelope<T>(payload);
  }
  throw new Error(`POST ${path} returned an invalid response`);
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T> | T | unknown): T {
  return normalizeEnvelope<T>(payload).data;
}

function normalizeEnvelope<T>(payload: ApiEnvelope<T> | T | unknown): ApiEnvelope<T> {
  if (isEnvelope<T>(payload)) {
    return payload;
  }
  return { data: payload as T };
}

function isEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return Boolean(payload && typeof payload === "object" && "data" in payload);
}
