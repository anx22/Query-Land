import { randomUUID } from "node:crypto";
import type { SourceMapEntry } from "@seo-tool/domain-model";
import { mapSourceMapEntry } from "../sqlite-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

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

export interface SourceMapStore {
  listSourceMapEntries(): SourceMapEntry[];
  upsertSourceMapEntry(projectId: string, input: SourceMapUpsertInput): SourceMapEntry;
  resolveSourceAnchor(url: string): ResolvedSourceAnchor | null;
  createDeployMarker(projectId: string, input: DeployMarkerInput): DeployMarker;
  listDeployMarkers(projectId: string): DeployMarker[];
}

export function createSourceMapStore(db: SQLiteDatabase, audit: AuditLog): SourceMapStore {
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
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  listSourceMapEntries(): SourceMapEntry[] {
    return this.db.prepare(`
      SELECT url_template_map.id, url_template_map.project_id, url_template_map.url_pattern, templates.name AS template,
             templates.component, templates.repo_path, url_template_map.confidence
      FROM url_template_map
      JOIN templates ON templates.id = url_template_map.template_id
      ORDER BY url_template_map.created_at ASC
    `).all().map(mapSourceMapEntry);
  }

  upsertSourceMapEntry(projectId: string, input: SourceMapUpsertInput): SourceMapEntry {
    const project = this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId);
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

    this.db.exec("BEGIN");
    try {
      // source_repo: find or create per project + repo_url.
      let repoId = (this.db.prepare(`SELECT id FROM source_repos WHERE project_id = ? AND repo_url = ?`).get(projectId, repoUrl) as { id: string } | undefined)?.id;
      if (!repoId) {
        repoId = `repo-${randomUUID()}`;
        this.db.prepare(`INSERT INTO source_repos (id, project_id, repo_url, default_branch, created_at) VALUES (?, ?, ?, ?, ?)`).run(repoId, projectId, repoUrl, defaultBranch, now);
      }
      // template: find or create per source_repo + repo_path; keep name/component current.
      const existingTemplate = this.db.prepare(`SELECT id FROM templates WHERE source_repo_id = ? AND repo_path = ?`).get(repoId, repoPath) as { id: string } | undefined;
      let templateId: string;
      if (existingTemplate) {
        templateId = existingTemplate.id;
        this.db.prepare(`UPDATE templates SET name = ?, component = ? WHERE id = ?`).run(templateName, component, templateId);
      } else {
        templateId = `tpl-${randomUUID()}`;
        this.db.prepare(`INSERT INTO templates (id, source_repo_id, name, component, repo_path) VALUES (?, ?, ?, ?, ?)`).run(templateId, repoId, templateName, component, repoPath);
      }
      // url_template_map: upsert per project + url_pattern + template.
      const existingMap = this.db.prepare(`SELECT id FROM url_template_map WHERE project_id = ? AND url_pattern = ? AND template_id = ?`).get(projectId, urlPattern, templateId) as { id: string } | undefined;
      if (existingMap) {
        this.db.prepare(`UPDATE url_template_map SET confidence = ? WHERE id = ?`).run(confidence, existingMap.id);
      } else {
        this.db.prepare(`INSERT INTO url_template_map (id, project_id, url_pattern, template_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(`utm-${randomUUID()}`, projectId, urlPattern, templateId, confidence, now);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    this.audit("system", "source_map.upsert", "url_template_map", urlPattern, { projectId, repoPath });
    const entry = this.db.prepare(`
      SELECT url_template_map.id, url_template_map.project_id, url_template_map.url_pattern, templates.name AS template,
             templates.component, templates.repo_path, url_template_map.confidence
      FROM url_template_map
      JOIN templates ON templates.id = url_template_map.template_id
      WHERE url_template_map.project_id = ? AND url_template_map.url_pattern = ?
      ORDER BY url_template_map.created_at DESC LIMIT 1
    `).get(projectId, urlPattern);
    return mapSourceMapEntry(entry as Record<string, unknown>);
  }

  resolveSourceAnchor(url: string): ResolvedSourceAnchor | null {
    requireString(url, "url");
    const entries = this.listSourceMapEntries();
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

  createDeployMarker(projectId: string, input: DeployMarkerInput): DeployMarker {
    const project = this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId);
    if (!project) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    const commitSha = requireString(input.commitSha, "commitSha");
    const deployedAt = input.deployedAt && input.deployedAt.trim() !== "" ? input.deployedAt : new Date().toISOString();
    const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
    const id = `deploy-${randomUUID()}`;
    this.db.prepare(`INSERT INTO deploy_markers (id, project_id, commit_sha, deployed_at, metadata) VALUES (?, ?, ?, ?, ?)`).run(id, projectId, commitSha, deployedAt, JSON.stringify(metadata));
    this.audit("system", "deploy_marker.create", "deploy_marker", id, { projectId, commitSha });
    return { id, projectId, commitSha, deployedAt, metadata };
  }

  listDeployMarkers(projectId: string): DeployMarker[] {
    return this.db.prepare(`SELECT * FROM deploy_markers WHERE project_id = ? ORDER BY deployed_at DESC, id ASC`).all(projectId).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      commitSha: String(row.commit_sha),
      deployedAt: String(row.deployed_at),
      metadata: parseMetadata(row.metadata)
    }));
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
