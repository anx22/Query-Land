import { randomUUID } from "node:crypto";
import { sourceConfidenceForProvider, validateBusinessValue, type IntegrationAccount, type IntegrationProvider, type Project, type Site } from "@seo-tool/domain-model";
import { mapIntegration, mapProject, mapSite } from "../sqlite-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError, sqliteConstraintError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

export interface ProjectStore {
  listProjects(): Project[];
  createProject(input: Partial<Project>): Project;
  listSites(projectId: string): Site[];
  createSite(projectId: string, input: Partial<Site>): Site;
  listIntegrations(): IntegrationAccount[];
  createIntegration(projectId: string, provider: IntegrationProvider): IntegrationAccount;
}

export function createProjectStore(db: SQLiteDatabase, audit: AuditLog): ProjectStore {
  return new SQLiteProjectStore(db, audit);
}

class SQLiteProjectStore implements ProjectStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  listProjects(): Project[] {
    return this.db.prepare(`SELECT * FROM projects ORDER BY created_at ASC`).all().map(mapProject);
  }

  createProject(input: Partial<Project>): Project {
    if (!input.name || !input.slug) {
      throw new RequestError(400, "missing_field", "name and slug are required");
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: `proj-${input.slug}`,
      name: input.name,
      slug: input.slug,
      status: input.status ?? "draft",
      defaultLocale: input.defaultLocale ?? "de-DE",
      markets: input.markets ?? [{ country: "DE", language: "de", device: "desktop", searchEngine: "google" }],
      createdAt: now,
      updatedAt: now
    };
    try {
      this.db.prepare(`INSERT INTO projects (id, name, slug, status, default_locale, markets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(project.id, project.name, project.slug, project.status, project.defaultLocale, JSON.stringify(project.markets), project.createdAt, project.updatedAt);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_project_slug", "Project slug already exists");
    }
    this.audit("system", "project.create", "project", project.id, { slug: project.slug });
    return project;
  }

  listSites(projectId: string): Site[] {
    return this.db.prepare(`SELECT * FROM sites WHERE project_id = ? ORDER BY created_at ASC`).all(projectId).map(mapSite);
  }

  createSite(projectId: string, input: Partial<Site>): Site {
    if (!input.baseUrl || !input.scopeType) {
      throw new RequestError(400, "missing_field", "baseUrl and scopeType are required");
    }
    const site: Site = {
      id: `site-${randomUUID()}`,
      projectId,
      baseUrl: input.baseUrl,
      scopeType: input.scopeType,
      crawlFrequency: input.crawlFrequency ?? "weekly",
      businessValue: validateBusinessValue(input.businessValue ?? 50)
    };
    try {
      this.db.prepare(`INSERT INTO sites (id, project_id, scope_type, base_url, crawl_frequency, business_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(site.id, site.projectId, site.scopeType, site.baseUrl, site.crawlFrequency, site.businessValue, new Date().toISOString());
    } catch (error) {
      throw sqliteConstraintError(error, "site_write_failed", "Site could not be stored");
    }
    this.audit("system", "site.create", "site", site.id, { projectId, baseUrl: site.baseUrl });
    return site;
  }

  listIntegrations(): IntegrationAccount[] {
    return this.db.prepare(`SELECT * FROM integration_accounts ORDER BY created_at ASC`).all().map(mapIntegration);
  }

  createIntegration(projectId: string, provider: IntegrationProvider): IntegrationAccount {
    const now = new Date().toISOString();
    const integration: IntegrationAccount = {
      id: `int-${provider}-${randomUUID()}`,
      projectId,
      provider,
      status: "pending",
      sourceConfidence: sourceConfidenceForProvider(provider),
      quotaRemaining: null,
      freshness: null
    };
    try {
      this.db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`).run(integration.id, integration.projectId, integration.provider, integration.status, integration.sourceConfidence, integration.quotaRemaining, integration.freshness, now, now);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_integration", "Integration already exists or project is unknown");
    }
    this.audit("system", "integration.create", "integration_account", integration.id, { projectId, provider });
    return integration;
  }
}
