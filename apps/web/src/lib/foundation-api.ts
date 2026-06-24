import { apiBaseUrl, apiGet, apiPost } from "./api-client";

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

export async function loadFoundationDashboardData(): Promise<FoundationDashboardData> {
  try {
    const projects = await apiGet<FoundationProject[]>("/projects");
    const { getActiveProjectId } = await import("./active-project");
    const activeProjectId = await getActiveProjectId();
    const selectedProject =
      (activeProjectId ? projects.find((project) => project.id === activeProjectId) : null) ??
      projects[0] ??
      null;
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
