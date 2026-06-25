import { randomUUID } from "node:crypto";
import type { SourceMapEntry } from "@seo-tool/domain-model";
import { mapSourceMapEntry } from "../row-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export type SourceMapConfidence = "exact" | "manifest" | "heuristic" | "unknown";

export interface SourceMapUpsertInput {
  repoUrl: string;
  defaultBranch?: string;
  urlPattern: string;
  templateName: string;
  component: string;
  repoPath: string;
  confidence?: SourceMapConfidence;
}

export interface ResolvedSourceAnchor {
  urlPattern: string;
  template: string;
  component: string;
  repoPath: string;
  confidence: SourceMapConfidence;
}

export interface DeployMarker {
  id: string;
  projectId: string;
  commitSha: string;
  deployedAt: string;
  metadata: Record<string, unknown>;
}

export interface DeployMarkerInput {
  commitSha: string;
  deployedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PrCheckInput {
  changedPaths: string[];
  prNumber?: number;
  headSha?: string;
}

export interface PrCheckAffectedTemplate {
  repoPath: string;
  template: string;
  component: string;
  urlPattern: string;
  matchedChangedPath: string;
}

export interface PrCheckRelatedOpportunity {
  id: string;
  type: string;
  status: string;
  priority: number;
  affectedUrls: string[];
  matchedBy: "url_pattern" | "source_anchor";
}

export type PrCheckStatus = "passed" | "review_required" | "unmapped";

export interface PrCheckResult {
  id: string;
  projectId: string;
  prNumber: number | null;
  headSha: string | null;
  changedPaths: string[];
  status: PrCheckStatus;
  affectedTemplates: PrCheckAffectedTemplate[];
  affectedUrlPatterns: string[];
  relatedOpportunities: PrCheckRelatedOpportunity[];
  createdAt: string;
}

export interface SourceMapStore {
  listSourceMapEntries(): Promise<SourceMapEntry[]>;
  upsertSourceMapEntry(projectId: string, input: SourceMapUpsertInput): Promise<SourceMapEntry>;
  resolveSourceAnchor(url: string): Promise<ResolvedSourceAnchor | null>;
  createDeployMarker(projectId: string, input: DeployMarkerInput): Promise<DeployMarker>;
  listDeployMarkers(projectId: string): Promise<DeployMarker[]>;
  // WP-3.3: Pre-Merge-Gate — geänderte Repo-Pfade -> betroffene Templates/URLs -> offene Opportunities.
  evaluatePrCheck(projectId: string, input: PrCheckInput): Promise<PrCheckResult>;
  listPrChecks(projectId: string): Promise<PrCheckResult[]>;
}

export function createSourceMapStore(db: AsyncDatabase, audit: AuditLog): SourceMapStore {
  return new SQLiteSourceMapStore(db, audit);
}

const CONFIDENCES: readonly SourceMapConfidence[] = ["exact", "manifest", "heuristic", "unknown"];

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RequestError(400, "missing_field", `${field} is required`);
  }
  return value;
}

class SQLiteSourceMapStore implements SourceMapStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  async listSourceMapEntries(): Promise<SourceMapEntry[]> {
    return (await this.db.prepare(`
      SELECT url_template_map.id, url_template_map.project_id, url_template_map.url_pattern, templates.name AS template,
             templates.component, templates.repo_path, url_template_map.confidence
      FROM url_template_map
      JOIN templates ON templates.id = url_template_map.template_id
      ORDER BY url_template_map.created_at ASC
    `).all()).map(mapSourceMapEntry);
  }

  async upsertSourceMapEntry(projectId: string, input: SourceMapUpsertInput): Promise<SourceMapEntry> {
    const project = await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId);
    if (!project) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    const repoUrl = requireString(input.repoUrl, "repoUrl");
    const urlPattern = requireString(input.urlPattern, "urlPattern");
    const templateName = requireString(input.templateName, "templateName");
    const component = requireString(input.component, "component");
    const repoPath = requireString(input.repoPath, "repoPath");
    const confidence: SourceMapConfidence = input.confidence && CONFIDENCES.includes(input.confidence) ? input.confidence : "manifest";
    const defaultBranch = input.defaultBranch && input.defaultBranch.trim() !== "" ? input.defaultBranch : "main";
    const now = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      // source_repo: find or create per project + repo_url.
      let repoId = (await tx.prepare(`SELECT id FROM source_repos WHERE project_id = ? AND repo_url = ?`).get(projectId, repoUrl) as { id: string } | undefined)?.id;
      if (!repoId) {
        repoId = `repo-${randomUUID()}`;
        await tx.prepare(`INSERT INTO source_repos (id, project_id, repo_url, default_branch, created_at) VALUES (?, ?, ?, ?, ?)`).run(repoId, projectId, repoUrl, defaultBranch, now);
      }
      // template: find or create per source_repo + repo_path; keep name/component current.
      const existingTemplate = await tx.prepare(`SELECT id FROM templates WHERE source_repo_id = ? AND repo_path = ?`).get(repoId, repoPath) as { id: string } | undefined;
      let templateId: string;
      if (existingTemplate) {
        templateId = existingTemplate.id;
        await tx.prepare(`UPDATE templates SET name = ?, component = ? WHERE id = ?`).run(templateName, component, templateId);
      } else {
        templateId = `tpl-${randomUUID()}`;
        await tx.prepare(`INSERT INTO templates (id, source_repo_id, name, component, repo_path) VALUES (?, ?, ?, ?, ?)`).run(templateId, repoId, templateName, component, repoPath);
      }
      // url_template_map: upsert per project + url_pattern + template.
      const existingMap = await tx.prepare(`SELECT id FROM url_template_map WHERE project_id = ? AND url_pattern = ? AND template_id = ?`).get(projectId, urlPattern, templateId) as { id: string } | undefined;
      if (existingMap) {
        await tx.prepare(`UPDATE url_template_map SET confidence = ? WHERE id = ?`).run(confidence, existingMap.id);
      } else {
        await tx.prepare(`INSERT INTO url_template_map (id, project_id, url_pattern, template_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(`utm-${randomUUID()}`, projectId, urlPattern, templateId, confidence, now);
      }
    });

    await this.audit("system", "source_map.upsert", "url_template_map", urlPattern, { projectId, repoPath });
    const entry = await this.db.prepare(`
      SELECT url_template_map.id, url_template_map.project_id, url_template_map.url_pattern, templates.name AS template,
             templates.component, templates.repo_path, url_template_map.confidence
      FROM url_template_map
      JOIN templates ON templates.id = url_template_map.template_id
      WHERE url_template_map.project_id = ? AND url_template_map.url_pattern = ?
      ORDER BY url_template_map.created_at DESC LIMIT 1
    `).get(projectId, urlPattern);
    return mapSourceMapEntry(entry as Record<string, unknown>);
  }

  async resolveSourceAnchor(url: string): Promise<ResolvedSourceAnchor | null> {
    requireString(url, "url");
    const entries = await this.listSourceMapEntries();
    // Exact match beats prefix heuristic; among prefixes the longest pattern wins.
    const exact = entries.find((entry) => entry.urlPattern === url);
    const chosen = exact ?? entries
      .filter((entry) => url.startsWith(entry.urlPattern))
      .sort((a, b) => b.urlPattern.length - a.urlPattern.length)[0];
    if (!chosen) return null;
    return {
      urlPattern: chosen.urlPattern,
      template: chosen.template,
      component: chosen.component,
      repoPath: chosen.repoPath,
      confidence: chosen.confidence as SourceMapConfidence
    };
  }

  async createDeployMarker(projectId: string, input: DeployMarkerInput): Promise<DeployMarker> {
    const project = await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId);
    if (!project) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    const commitSha = requireString(input.commitSha, "commitSha");
    const deployedAt = input.deployedAt && input.deployedAt.trim() !== "" ? input.deployedAt : new Date().toISOString();
    const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
    const id = `deploy-${randomUUID()}`;
    await this.db.prepare(`INSERT INTO deploy_markers (id, project_id, commit_sha, deployed_at, metadata) VALUES (?, ?, ?, ?, ?)`).run(id, projectId, commitSha, deployedAt, JSON.stringify(metadata));
    await this.audit("system", "deploy_marker.create", "deploy_marker", id, { projectId, commitSha });
    return { id, projectId, commitSha, deployedAt, metadata };
  }

  async listDeployMarkers(projectId: string): Promise<DeployMarker[]> {
    return (await this.db.prepare(`SELECT * FROM deploy_markers WHERE project_id = ? ORDER BY deployed_at DESC, id ASC`).all(projectId)).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      commitSha: String(row.commit_sha),
      deployedAt: String(row.deployed_at),
      metadata: parseMetadata(row.metadata)
    }));
  }

  async evaluatePrCheck(projectId: string, input: PrCheckInput): Promise<PrCheckResult> {
    if (!await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId)) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    const changedPaths = Array.isArray(input.changedPaths) ? input.changedPaths.filter((path) => typeof path === "string" && path.trim() !== "").map((path) => path.trim()) : [];
    if (changedPaths.length === 0) {
      throw new RequestError(400, "missing_field", "changedPaths must be a non-empty array of repo paths");
    }

    // Geänderte Pfade -> betroffene Source-Map-Einträge (Template + URL-Muster).
    const entries = await this.listSourceMapEntries();
    const affectedTemplates: PrCheckAffectedTemplate[] = [];
    for (const entry of entries) {
      const matched = changedPaths.find((changed) => pathsRelated(changed, entry.repoPath));
      if (matched) {
        affectedTemplates.push({ repoPath: entry.repoPath, template: entry.template, component: entry.component, urlPattern: entry.urlPattern, matchedChangedPath: matched });
      }
    }
    const affectedUrlPatterns = [...new Set(affectedTemplates.map((template) => template.urlPattern))];

    // Offene Opportunities, die betroffen sind — über URL-Muster oder direkten Source-Anchor.
    const openRows = await this.db.prepare(`SELECT id, type, status, priority, affected_urls, source_anchor FROM opportunities WHERE project_id = ? AND status NOT IN ('dismissed', 'expired', 'validated')`).all(projectId) as Array<{ id: string; type: string; status: string; priority: number; affected_urls: string; source_anchor: string | null }>;
    const relatedOpportunities: PrCheckRelatedOpportunity[] = [];
    for (const row of openRows) {
      const affectedUrls = safeJsonArray(row.affected_urls);
      const byUrlPattern = affectedUrls.some((url) => affectedUrlPatterns.some((pattern) => url === pattern || url.startsWith(pattern)));
      const anchorPath = anchorRepoPath(row.source_anchor);
      const bySourceAnchor = anchorPath !== null && changedPaths.some((changed) => pathsRelated(changed, anchorPath));
      if (byUrlPattern || bySourceAnchor) {
        relatedOpportunities.push({ id: row.id, type: String(row.type), status: String(row.status), priority: Number(row.priority), affectedUrls, matchedBy: bySourceAnchor ? "source_anchor" : "url_pattern" });
      }
    }
    relatedOpportunities.sort((left, right) => right.priority - left.priority);

    let status: PrCheckStatus;
    if (affectedTemplates.length === 0 && relatedOpportunities.length === 0) {
      status = "unmapped";
    } else if (relatedOpportunities.length > 0) {
      status = "review_required";
    } else {
      status = "passed";
    }

    const id = `prcheck-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const prNumber = typeof input.prNumber === "number" && Number.isFinite(input.prNumber) ? Math.trunc(input.prNumber) : null;
    const headSha = typeof input.headSha === "string" && input.headSha.trim() !== "" ? input.headSha.trim() : null;
    await this.db.prepare(`INSERT INTO pr_checks (id, project_id, pr_number, head_sha, changed_paths, status, affected_templates, affected_url_patterns, related_opportunity_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, projectId, prNumber, headSha, JSON.stringify(changedPaths), status, JSON.stringify(affectedTemplates), JSON.stringify(affectedUrlPatterns), JSON.stringify(relatedOpportunities), createdAt
    );
    await this.audit("system", "pr_check.evaluate", "pr_check", id, { projectId, status, affected: affectedTemplates.length, related: relatedOpportunities.length });
    return { id, projectId, prNumber, headSha, changedPaths, status, affectedTemplates, affectedUrlPatterns, relatedOpportunities, createdAt };
  }

  async listPrChecks(projectId: string): Promise<PrCheckResult[]> {
    return (await this.db.prepare(`SELECT * FROM pr_checks WHERE project_id = ? ORDER BY created_at DESC, id ASC`).all(projectId)).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      prNumber: row.pr_number === null || row.pr_number === undefined ? null : Number(row.pr_number),
      headSha: row.head_sha === null || row.head_sha === undefined ? null : String(row.head_sha),
      changedPaths: safeJsonArray(row.changed_paths),
      status: String(row.status) as PrCheckStatus,
      affectedTemplates: safeJsonValue<PrCheckAffectedTemplate[]>(row.affected_templates, []),
      affectedUrlPatterns: safeJsonArray(row.affected_url_patterns),
      relatedOpportunities: safeJsonValue<PrCheckRelatedOpportunity[]>(row.related_opportunity_ids, []),
      createdAt: String(row.created_at)
    }));
  }
}

// Pfadbezug: identisch oder eines ist Verzeichnis-Präfix des anderen (segmentweise).
function pathsRelated(changed: string, repoPath: string): boolean {
  const a = changed.replace(/^\/+|\/+$/g, "");
  const b = repoPath.replace(/^\/+|\/+$/g, "");
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function safeJsonArray(raw: unknown): string[] {
  const value = safeJsonValue<unknown[]>(raw, []);
  return value.filter((item): item is string => typeof item === "string");
}

function safeJsonValue<T>(raw: unknown, fallback: T): T {
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function anchorRepoPath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { repositoryPath?: unknown };
    return typeof parsed.repositoryPath === "string" && parsed.repositoryPath.trim() !== "" ? parsed.repositoryPath : null;
  } catch {
    return null;
  }
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
