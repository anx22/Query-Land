import type {
  AiVisibilityScore,
  AlertEvent,
  AuditIssueRecord,
  AuditIssueSeverity,
  AuthoritySummary,
  BacklinkDiff,
  CrawlHealthScore,
  DiscoveredUrl,
  IndexabilityRecord,
  Opportunity,
  OpportunityStatus,
  Proposal,
  ReferringDomain,
  Report,
  Site,
  UrlFetchRecord
} from "@seo-tool/domain-model";
import type { Store as BackendStore } from "@seo-tool/api";

/**
 * JSON-Schema subset used for MCP tool input declarations. Kept intentionally
 * small (object schemas only) so it stays dependency-free and serialisable.
 */
export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean";
  description?: string;
  enum?: readonly string[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler(args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Error carrying a stable machine code; mirrors RequestError semantics from the
 * API store layer without depending on its internals.
 */
export class ToolError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ToolError";
  }
}

const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = [
  "open",
  "planned",
  "in_progress",
  "implemented",
  "validated",
  "reopened",
  "dismissed",
  "expired"
];

const OPPORTUNITY_TYPES: readonly Opportunity["type"][] = [
  "technical_fix",
  "low_hanging_keyword",
  "cannibalization",
  "money_page",
  "internal_link_gap",
  "aeo"
];

const AUDIT_ISSUE_STATUSES = ["open", "resolved", "all"] as const;
const AUDIT_ISSUE_SEVERITIES: readonly AuditIssueSeverity[] = ["critical", "high", "medium", "low"];
const AUDIT_ISSUE_RULES = [
  "http_error",
  "redirect_chain",
  "missing_title",
  "duplicate_title",
  "canonical_mismatch",
  "broken_link"
] as const;

const MAX_PAGE = 200;

function requireString(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ToolError("missing_field", `${field} is required and must be a non-empty string`);
  }
  return value;
}

function optionalString(args: Record<string, unknown>, field: string): string | undefined {
  const value = args[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ToolError("invalid_field", `${field} must be a string`);
  }
  return value;
}

function optionalEnum<T extends string>(args: Record<string, unknown>, field: string, allowed: readonly T[]): T | undefined {
  const value = optionalString(args, field);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) {
    throw new ToolError("invalid_field", `${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function optionalCount(args: Record<string, unknown>, field: string): number | undefined {
  const value = args[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolError("invalid_field", `${field} must be a number`);
  }
  return Math.max(0, Math.trunc(value));
}

async function findSite(store: BackendStore, projectId: string, siteId: string): Promise<Site> {
  const site = (await store.listSites(projectId)).find((candidate) => candidate.id === siteId);
  if (!site) {
    throw new ToolError("unknown_site", `Site ${siteId} was not found in project ${projectId}`);
  }
  return site;
}

async function requireProjectId(store: BackendStore, args: Record<string, unknown>): Promise<string> {
  const projectId = requireString(args, "projectId");
  if (!(await store.listProjects()).some((candidate) => candidate.id === projectId)) {
    throw new ToolError("unknown_project", `Project ${projectId} was not found`);
  }
  return projectId;
}

interface SiteHealth {
  site: Site;
  latestHealthScore: CrawlHealthScore | null;
  openIssueCount: number;
}

async function buildProjectSummary(store: BackendStore, projectId: string) {
  const project = (await store.listProjects()).find((candidate) => candidate.id === projectId);
  if (!project) {
    throw new ToolError("unknown_project", `Project ${projectId} was not found`);
  }
  const sites = await store.listSites(projectId);

  const siteHealth: SiteHealth[] = await Promise.all(sites.map(async (site) => {
    const healthScores = await store.listHealthScores(projectId, site.id);
    // listHealthScores is ordered generated_at DESC, so the first entry is latest.
    const latestHealthScore = healthScores[0] ?? null;
    const openIssues = await store.listAuditIssuesPage(projectId, site.id, { limit: 1, offset: 0 }, { status: "open" });
    return { site, latestHealthScore, openIssueCount: openIssues.total };
  }));

  const openOpportunities = await store.listOpportunitiesPage(projectId, { limit: 1, offset: 0 }, { status: "open" });

  // Project-wide top open audit issues, severity-ranked in one SQL query (critical first).
  const topOpenAuditIssues = await store.listTopOpenAuditIssuesByProject(projectId, 10);

  return {
    project,
    sites: siteHealth,
    openOpportunityCount: openOpportunities.total,
    topOpenAuditIssues
  };
}

interface ResolvedUrlRow {
  site: Site;
  discoveredUrl: DiscoveredUrl;
}

/**
 * Locate the discovered-URL row for a (project[, site], url) tuple. When siteId
 * is omitted we scan all sites in the project. Matches url OR normalizedUrl.
 */
async function resolveDiscoveredUrl(store: BackendStore, projectId: string, siteId: string | undefined, url: string): Promise<ResolvedUrlRow> {
  // Validate an explicit site up-front to preserve the prior unknown-site error path.
  const explicitSite = siteId ? await findSite(store, projectId, siteId) : undefined;
  const discoveredUrl = await store.findDiscoveredUrlInProject(projectId, url, siteId);
  if (!discoveredUrl) {
    throw new ToolError("unknown_url", `No discovered URL matching ${url} was found in project ${projectId}`);
  }
  const site = explicitSite ?? (await store.listSites(projectId)).find((candidate) => candidate.id === discoveredUrl.siteId);
  if (!site) {
    throw new ToolError("unknown_url", `No discovered URL matching ${url} was found in project ${projectId}`);
  }
  return { site, discoveredUrl };
}

async function buildUrlDossier(store: BackendStore, projectId: string, siteId: string | undefined, url: string) {
  const { site, discoveredUrl } = await resolveDiscoveredUrl(store, projectId, siteId, url);

  const fetchHistory: UrlFetchRecord[] = await store.listFetchResults(projectId, site.id, discoveredUrl.id);
  const indexabilityAssessments: IndexabilityRecord[] = await store.listIndexabilityAssessments(projectId, site.id, discoveredUrl.id);

  const inlinks = await store.listInternalLinks(projectId, site.id, "in", discoveredUrl.normalizedUrl, { limit: MAX_PAGE });
  const outlinks = await store.listInternalLinks(projectId, site.id, "out", discoveredUrl.normalizedUrl, { limit: MAX_PAGE });

  // Audit issues that reference this URL (matched by URL or normalized URL).
  const auditIssues: AuditIssueRecord[] = [];
  let issueOffset = 0;
  for (;;) {
    const page = await store.listAuditIssuesPage(projectId, site.id, { limit: MAX_PAGE, offset: issueOffset });
    for (const issue of page.data) {
      if (issue.url === discoveredUrl.url || issue.url === discoveredUrl.normalizedUrl || issue.discoveredUrlId === discoveredUrl.id) {
        auditIssues.push(issue);
      }
    }
    if (page.nextCursor === null || page.data.length === 0) break;
    issueOffset += page.data.length;
  }

  // Opportunities whose affectedUrls include this URL (any status).
  const relatedOpportunities: Opportunity[] = [];
  let oppOffset = 0;
  for (;;) {
    const page = await store.listOpportunitiesPage(projectId, { limit: MAX_PAGE, offset: oppOffset });
    for (const opportunity of page.data) {
      if (opportunity.affectedUrls.includes(discoveredUrl.url) || opportunity.affectedUrls.includes(discoveredUrl.normalizedUrl)) {
        relatedOpportunities.push(opportunity);
      }
    }
    if (page.nextCursor === null || page.data.length === 0) break;
    oppOffset += page.data.length;
  }

  const sourceAnchor = await store.resolveSourceAnchor(discoveredUrl.url);

  return {
    site,
    discoveredUrl,
    fetchHistory,
    indexabilityAssessments,
    inlinks: inlinks.data,
    outlinks: outlinks.data,
    auditIssues,
    relatedOpportunities,
    sourceAnchor
  };
}

/**
 * Build the read-only MCP tool set bound to a BackendStore. Pure and unit
 * testable: every handler returns plain JSON-serialisable data.
 */
export function createSeoMcpTools(store: BackendStore): McpTool[] {
  return [
    {
      name: "get_project_summary",
      description:
        "Return project metadata, its sites with latest health scores, the count of open opportunities, and the top open audit issues across the project.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier (e.g. proj-acme)." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args) {
        const projectId = requireString(args, "projectId");
        return buildProjectSummary(store, projectId);
      }
    },
    {
      name: "get_url_dossier",
      description:
        "Resolve a discovered URL and return its fetch history, indexability assessments, internal inlinks/outlinks, audit issues, related opportunities, and resolved source anchor. siteId is optional; when omitted every site in the project is searched.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier." },
          siteId: { type: "string", description: "Optional site identifier to scope the lookup." },
          url: { type: "string", description: "The URL (or normalized URL) to build the dossier for." }
        },
        required: ["projectId", "url"],
        additionalProperties: false
      },
      async handler(args) {
        const projectId = await requireProjectId(store, args);
        const siteId = optionalString(args, "siteId");
        const url = requireString(args, "url");
        return buildUrlDossier(store, projectId, siteId, url);
      }
    },
    {
      name: "list_opportunities",
      description:
        "Return a priority-sorted page of opportunities for a project, each including its evidence, priority score, and validation metric. Optional filters: status, type. Supports limit/offset paging.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier." },
          status: { type: "string", description: "Filter by opportunity status.", enum: OPPORTUNITY_STATUSES },
          type: { type: "string", description: "Filter by opportunity type.", enum: OPPORTUNITY_TYPES },
          limit: { type: "integer", description: "Max items per page (1-200, default 50)." },
          offset: { type: "integer", description: "Number of items to skip." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args) {
        const projectId = requireString(args, "projectId");
        const status = optionalEnum(args, "status", OPPORTUNITY_STATUSES);
        const type = optionalEnum(args, "type", OPPORTUNITY_TYPES);
        const limit = optionalCount(args, "limit");
        const offset = optionalCount(args, "offset");
        return store.listOpportunitiesPage(projectId, { limit, offset }, { status, type });
      }
    },
    {
      name: "get_crawl_issues",
      description:
        "Return a page of audit (crawl) issues for a project + site. Optional filters: status (open/resolved/all), severity, rule. Supports limit/offset paging.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier." },
          siteId: { type: "string", description: "Site identifier." },
          status: { type: "string", description: "Filter by issue status.", enum: AUDIT_ISSUE_STATUSES },
          severity: { type: "string", description: "Filter by severity.", enum: AUDIT_ISSUE_SEVERITIES },
          rule: { type: "string", description: "Filter by audit rule.", enum: AUDIT_ISSUE_RULES },
          limit: { type: "integer", description: "Max items per page (1-200, default 50)." },
          offset: { type: "integer", description: "Number of items to skip." }
        },
        required: ["projectId", "siteId"],
        additionalProperties: false
      },
      async handler(args) {
        const projectId = requireString(args, "projectId");
        const siteId = requireString(args, "siteId");
        // Validate scope up front so callers get a clear not-found rather than an empty page.
        await findSite(store, projectId, siteId);
        const status = optionalEnum(args, "status", AUDIT_ISSUE_STATUSES);
        const severity = optionalEnum(args, "severity", AUDIT_ISSUE_SEVERITIES);
        const rule = optionalEnum(args, "rule", AUDIT_ISSUE_RULES);
        const limit = optionalCount(args, "limit");
        const offset = optionalCount(args, "offset");
        return store.listAuditIssuesPage(projectId, siteId, { limit, offset }, { status, severity, rule });
      }
    },
    {
      name: "explain_opportunity",
      description:
        "Return the full opportunity record (evidence, currentState, recommendedAction, priority, validationMetric, sourceAnchor) for an opportunity id.",
      inputSchema: {
        type: "object",
        properties: {
          opportunityId: { type: "string", description: "Opportunity identifier (e.g. opp-...)." }
        },
        required: ["opportunityId"],
        additionalProperties: false
      },
      async handler(args) {
        const opportunityId = requireString(args, "opportunityId");
        let opportunity: Opportunity;
        try {
          opportunity = await store.getOpportunity(opportunityId);
        } catch {
          throw new ToolError("unknown_opportunity", `Opportunity ${opportunityId} was not found`);
        }
        const sourceAnchor =
          opportunity.affectedUrls.length > 0 ? await store.resolveSourceAnchor(opportunity.affectedUrls[0]) : null;
        return {
          opportunity,
          evidence: opportunity.evidence,
          currentState: opportunity.currentState,
          recommendedAction: opportunity.recommendedAction,
          priority: opportunity.priority,
          validationMetric: opportunity.validationMetric,
          sourceAnchor: opportunity.sourceAnchor ?? sourceAnchor
        };
      }
    },
    {
      name: "get_authority_summary",
      description:
        "Return an authority summary for a project: total backlinks, referring domain count, follow ratio, top referring domains, top anchors, and top target URLs. Based on the latest imported backlink snapshot.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args): Promise<AuthoritySummary> {
        const projectId = await requireProjectId(store, args);
        return store.authoritySummary(projectId);
      }
    },
    {
      name: "list_referring_domains",
      description:
        "Return all referring domains from the latest backlink snapshot for a project. Each entry includes domain, backlink count, unique target URL count, follow share, and first/last seen dates.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args): Promise<ReferringDomain[]> {
        const projectId = await requireProjectId(store, args);
        return store.listReferringDomains(projectId);
      }
    },
    {
      name: "get_backlink_changes",
      description:
        "Return the diff between the two most recent backlink snapshots: new/lost backlinks, new/lost referring domains, and net change counts. Requires at least one snapshot to exist; throws no_snapshots when none are present.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args): Promise<BacklinkDiff> {
        const projectId = await requireProjectId(store, args);
        try {
          return await store.backlinkDiff(projectId);
        } catch (error) {
          // The backlink store throws a RequestError with code "no_snapshots" when
          // no snapshots have been imported yet. Surface this as a clean ToolError.
          if (error instanceof Error && "code" in error && (error as { code: string }).code === "no_snapshots") {
            throw new ToolError("no_snapshots", "No backlink snapshots have been imported for this project yet. Run an import first.");
          }
          throw error;
        }
      }
    },
    {
      name: "get_latest_report",
      description:
        "Return the most recently generated report for a project. The response shape is `{ report: Report | null }`: `report` is `null` when no report has been generated yet, otherwise the full Report object (id, projectId, type, title, sections, generatedAt).",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier (e.g. proj-acme)." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args): Promise<{ report: Report | null }> {
        const projectId = await requireProjectId(store, args);
        const report = (await store.listReports(projectId))[0] ?? null;
        return { report };
      }
    },
    {
      name: "list_alert_events",
      description:
        "Return all alert evaluation events for a project, ordered newest first. Each event records the rule that was evaluated, the observed metric value, the threshold, and whether the alert was triggered.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier (e.g. proj-acme)." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args): Promise<AlertEvent[]> {
        const projectId = await requireProjectId(store, args);
        return store.listAlertEvents(projectId);
      }
    },
    {
      name: "get_ai_visibility",
      description:
        "Return the AI visibility score for a project: the fraction of tracked prompts in which the project's own domain is cited by an LLM, plus brand mention counts. Requires at least one AI prompt and snapshot to have been recorded.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier (e.g. proj-acme)." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args): Promise<AiVisibilityScore> {
        const projectId = await requireProjectId(store, args);
        return store.aiVisibilityScore(projectId);
      }
    },
    {
      name: "list_proposals",
      description:
        "Return all proposals for a project (dev tickets and fix-PR proposals), ordered newest first. Each proposal includes its kind, title, body, status, and optional linked opportunity.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier (e.g. proj-acme)." }
        },
        required: ["projectId"],
        additionalProperties: false
      },
      async handler(args): Promise<Proposal[]> {
        const projectId = await requireProjectId(store, args);
        return store.listProposals(projectId);
      }
    },
    {
      name: "create_dev_ticket",
      description:
        "Create a draft developer ticket proposal for a project. This tool is REVIEW-GATED (§4.4): it creates a proposed artifact only — never a direct production change. A human must accept or reject the proposal before any action is taken. Optionally links to an opportunity.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier (e.g. proj-acme)." },
          title: { type: "string", description: "Short title for the dev ticket." },
          body: { type: "string", description: "Full description / acceptance criteria for the ticket." },
          opportunityId: { type: "string", description: "Optional opportunity identifier to link this ticket to." }
        },
        required: ["projectId", "title", "body"],
        additionalProperties: false
      },
      async handler(args): Promise<Proposal> {
        const projectId = await requireProjectId(store, args);
        const title = requireString(args, "title");
        const body = requireString(args, "body");
        const opportunityId = optionalString(args, "opportunityId");
        return store.createProposal(projectId, { kind: "dev_ticket", title, body, opportunityId, source: "mcp" });
      }
    },
    {
      name: "propose_fix_pr",
      description:
        "Create a draft fix-PR proposal for a project. This tool is REVIEW-GATED (§4.4): it creates a proposed artifact only — never a direct production change. A human must accept or reject the proposal before any action is taken. Optionally links to an opportunity.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project identifier (e.g. proj-acme)." },
          title: { type: "string", description: "Short title for the fix PR." },
          body: { type: "string", description: "Full description of the fix, including the change rationale and implementation notes." },
          opportunityId: { type: "string", description: "Optional opportunity identifier to link this PR proposal to." }
        },
        required: ["projectId", "title", "body"],
        additionalProperties: false
      },
      async handler(args): Promise<Proposal> {
        const projectId = await requireProjectId(store, args);
        const title = requireString(args, "title");
        const body = requireString(args, "body");
        const opportunityId = optionalString(args, "opportunityId");
        return store.createProposal(projectId, { kind: "fix_pr", title, body, opportunityId, source: "mcp" });
      }
    }
  ];
}
