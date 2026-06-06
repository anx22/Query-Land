import { randomUUID } from "node:crypto";
import { sourceConfidenceForProvider, validateBusinessValue, type IntegrationAccount, type IntegrationProvider, type Project, type Site } from "@seo-tool/domain-model";
import { getConnector } from "../connectors/index.js";
import { mapIntegration, mapProject, mapSite } from "../sqlite-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError, sqliteConstraintError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

export interface ConnectorSyncResult {
  integration: IntegrationAccount;
  rawEventId: string;
  normalizedMetricsInserted: number;
}

export interface ConnectorSyncOptions {
  siteId?: string;
}

export interface WebVitalMetric {
  metric: string;
  value: number;
  measuredAt: string;
  sourceConfidence: string;
}

export interface ProjectStore {
  listProjects(): Project[];
  createProject(input: Partial<Project>): Project;
  listSites(projectId: string): Site[];
  createSite(projectId: string, input: Partial<Site>): Site;
  listIntegrations(): IntegrationAccount[];
  createIntegration(projectId: string, provider: IntegrationProvider): IntegrationAccount;
  runConnectorSync(integrationId: string, options?: ConnectorSyncOptions): ConnectorSyncResult;
  listSiteWebVitals(projectId: string, siteId: string): WebVitalMetric[];
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

  runConnectorSync(integrationId: string, options: ConnectorSyncOptions = {}): ConnectorSyncResult {
    const row = this.db.prepare(`SELECT * FROM integration_accounts WHERE id = ?`).get(integrationId);
    if (!row) {
      throw new RequestError(404, "unknown_integration", "Integration not found");
    }
    const integration = mapIntegration(row);
    const connector = getConnector(integration.provider);
    if (!connector) {
      throw new RequestError(400, "unsupported_connector", `No connector implemented for provider ${integration.provider}`);
    }

    // Optional site-scoped sync (z.B. PageSpeed/Web Vitals pro Site); sonst projektweit.
    let entityType = "project";
    let entityId = integration.projectId;
    if (options.siteId) {
      const site = this.db.prepare(`SELECT 1 FROM sites WHERE id = ? AND project_id = ?`).get(options.siteId, integration.projectId);
      if (!site) {
        throw new RequestError(404, "unknown_site", "Site not found for integration project");
      }
      entityType = "site";
      entityId = options.siteId;
    }

    const now = new Date().toISOString();
    const ctx = { projectId: integration.projectId, integrationId, now, entityType, entityId };
    try {
      const fetched = connector.fetch(ctx);
      connector.validate(fetched.payload);
      const metrics = connector.normalize(fetched.payload, ctx);
      const rawEventId = `raw-${randomUUID()}`;

      this.db.exec("BEGIN");
      try {
        // Rohdaten unverändert und getrennt von normalisierten Metriken speichern (§2.7, §3.2).
        this.db.prepare(`INSERT INTO raw_events (id, integration_account_id, source_type, source_confidence, payload, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(rawEventId, integrationId, connector.sourceType, connector.sourceConfidence, JSON.stringify(fetched.payload), now);
        const insertMetric = this.db.prepare(`INSERT INTO normalized_metrics (id, raw_event_id, project_id, metric, entity_type, entity_id, value, measured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const metric of metrics) {
          insertMetric.run(`nm-${randomUUID()}`, rawEventId, integration.projectId, metric.metric, metric.entityType, metric.entityId, metric.value, metric.measuredAt, connector.sourceConfidence);
        }
        this.db.prepare(`UPDATE integration_accounts SET status = 'connected', quota_remaining = ?, freshness = ?, updated_at = ? WHERE id = ?`)
          .run(fetched.quotaRemaining, fetched.freshness, now, integrationId);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }

      this.audit("system", "integration.sync", "integration_account", integrationId, { provider: integration.provider, metrics: metrics.length });
      const updatedRow = this.db.prepare(`SELECT * FROM integration_accounts WHERE id = ?`).get(integrationId);
      if (!updatedRow) {
        throw new RequestError(500, "integration_reload_failed", "Integration could not be reloaded after sync");
      }
      return { integration: mapIntegration(updatedRow), rawEventId, normalizedMetricsInserted: metrics.length };
    } catch (error) {
      if (error instanceof RequestError) {
        throw error;
      }
      this.db.prepare(`UPDATE integration_accounts SET status = 'error', updated_at = ? WHERE id = ?`).run(now, integrationId);
      this.audit("system", "integration.sync_error", "integration_account", integrationId, { provider: integration.provider, message: error instanceof Error ? error.message : String(error) });
      throw new RequestError(502, "connector_sync_failed", error instanceof Error ? error.message : "Connector sync failed");
    }
  }

  listSiteWebVitals(projectId: string, siteId: string): WebVitalMetric[] {
    const site = this.db.prepare(`SELECT 1 FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!site) {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
    // Neueste Web-Vitals-Metrik (PSI) je Kennzahl für die Site.
    const rows = this.db.prepare(`SELECT metric, value, measured_at, source_confidence FROM normalized_metrics WHERE project_id = ? AND entity_type = 'site' AND entity_id = ? AND metric LIKE 'psi\\_%' ESCAPE '\\' ORDER BY measured_at DESC`).all(projectId, siteId);
    const latest = new Map<string, WebVitalMetric>();
    for (const row of rows) {
      const metric = String(row.metric);
      if (!latest.has(metric)) {
        latest.set(metric, { metric, value: Number(row.value), measuredAt: String(row.measured_at), sourceConfidence: String(row.source_confidence) });
      }
    }
    return [...latest.values()].sort((left, right) => left.metric.localeCompare(right.metric));
  }
}
