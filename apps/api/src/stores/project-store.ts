import { randomUUID } from "node:crypto";
import { sourceConfidenceForProvider, validateBusinessValue, type IntegrationAccount, type IntegrationProvider, type Project, type Site } from "@seo-tool/domain-model";
import { getConnector, type ConnectorContract } from "../connectors/index.js";
import { mapIntegration, mapProject, mapSite } from "../row-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError, sqliteConstraintError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export interface ConnectorSyncResult {
  integration: IntegrationAccount;
  /** Maschinenlesbares Sync-Ergebnis ("ok" oder ein Fehlermodus). */
  outcome: ConnectorSyncOutcome;
  /** Vorhanden bei einem erfolgreichen Lauf; null, wenn der Lauf blockiert/degraded war. */
  rawEventId: string | null;
  normalizedMetricsInserted: number;
  /** Aktueller Connector-Vertrag/Status nach dem Lauf (auth/quota/freshness/capabilities). */
  contract: ConnectorContract;
  /** Menschenlesbarer Grund bei degraded/blocked Läufen. */
  reason?: string;
}

export type ConnectorSyncOutcome = "ok" | "missing_credentials" | "quota_exceeded" | "expired" | "degraded";

/**
 * Read-Sicht auf eine Integration: persistierter Account plus der typisierte
 * Connector-Vertrag (oder null, wenn für den Provider noch kein Connector registriert ist).
 */
export interface IntegrationStatusView extends IntegrationAccount {
  contract: ConnectorContract | null;
  lastSyncedAt: string | null;
  lastEvidenceAt: string | null;
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
  listProjects(): Promise<Project[]>;
  createProject(input: Partial<Project>): Promise<Project>;
  listSites(projectId: string): Promise<Site[]>;
  createSite(projectId: string, input: Partial<Site>): Promise<Site>;
  listIntegrations(): Promise<IntegrationStatusView[]>;
  getIntegration(integrationId: string): Promise<IntegrationStatusView>;
  createIntegration(projectId: string, provider: IntegrationProvider): Promise<IntegrationAccount>;
  runConnectorSync(integrationId: string, options?: ConnectorSyncOptions): Promise<ConnectorSyncResult>;
  listSiteWebVitals(projectId: string, siteId: string): Promise<WebVitalMetric[]>;
}

export function createProjectStore(db: AsyncDatabase, audit: AuditLog): ProjectStore {
  return new SQLiteProjectStore(db, audit);
}

class SQLiteProjectStore implements ProjectStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  async listProjects(): Promise<Project[]> {
    return (await this.db.prepare(`SELECT * FROM projects ORDER BY created_at ASC`).all()).map(mapProject);
  }

  async createProject(input: Partial<Project>): Promise<Project> {
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
      await this.db.prepare(`INSERT INTO projects (id, name, slug, status, default_locale, markets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(project.id, project.name, project.slug, project.status, project.defaultLocale, JSON.stringify(project.markets), project.createdAt, project.updatedAt);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_project_slug", "Project slug already exists");
    }
    await this.audit("system", "project.create", "project", project.id, { slug: project.slug });
    return project;
  }

  async listSites(projectId: string): Promise<Site[]> {
    return (await this.db.prepare(`SELECT * FROM sites WHERE project_id = ? ORDER BY created_at ASC`).all(projectId)).map(mapSite);
  }

  async createSite(projectId: string, input: Partial<Site>): Promise<Site> {
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
      await this.db.prepare(`INSERT INTO sites (id, project_id, scope_type, base_url, crawl_frequency, business_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(site.id, site.projectId, site.scopeType, site.baseUrl, site.crawlFrequency, site.businessValue, new Date().toISOString());
    } catch (error) {
      throw sqliteConstraintError(
        error,
        "site_write_failed",
        "Site could not be stored",
        `Diese Site-URL ist in diesem Projekt bereits angelegt (${site.baseUrl}). Bitte eine andere URL verwenden oder die bestehende Site nutzen.`
      );
    }
    await this.audit("system", "site.create", "site", site.id, { projectId, baseUrl: site.baseUrl });
    return site;
  }

  async listIntegrations(): Promise<IntegrationStatusView[]> {
    const rows = await this.db.prepare(`SELECT * FROM integration_accounts ORDER BY created_at ASC`).all();
    return Promise.all(rows.map((row) => this.toStatusView(row)));
  }

  async getIntegration(integrationId: string): Promise<IntegrationStatusView> {
    const row = await this.db.prepare(`SELECT * FROM integration_accounts WHERE id = ?`).get(integrationId);
    if (!row) {
      throw new RequestError(404, "unknown_integration", "Integration not found");
    }
    return this.toStatusView(row);
  }

  /** Ob am integration_account verwendbare Credentials (auth_config) hinterlegt sind. */
  private hasCredentials(row: Record<string, unknown>): boolean {
    const raw = row.auth_config;
    if (raw === null || raw === undefined) return false;
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return false;
      }
    }
    return Boolean(parsed) && typeof parsed === "object" && Object.keys(parsed as Record<string, unknown>).length > 0;
  }

  private async lastEvidenceAt(integrationId: string): Promise<string | null> {
    const row = await this.db.prepare(`SELECT fetched_at FROM raw_events WHERE integration_account_id = ? ORDER BY fetched_at DESC LIMIT 1`).get(integrationId);
    return row ? String(row.fetched_at) : null;
  }

  /** Persistierten Account mit dem typisierten Connector-Vertrag zu einer Status-Sicht verbinden. */
  private async toStatusView(row: Record<string, unknown>): Promise<IntegrationStatusView> {
    const integration = mapIntegration(row);
    const connector = getConnector(integration.provider);
    const lastSyncedAt = integration.freshness;
    const lastEvidenceAt = await this.lastEvidenceAt(integration.id);
    const contract = connector
      ? connector.describe({ hasCredentials: this.hasCredentials(row), lastSyncedAt, lastEvidenceAt })
      : null;
    return { ...integration, contract, lastSyncedAt, lastEvidenceAt };
  }

  async createIntegration(projectId: string, provider: IntegrationProvider): Promise<IntegrationAccount> {
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
    // Stub-Credentials: ein über die API angelegter Account gilt als verbunden (auth_config
    // nicht leer). Echte OAuth-Flows ersetzen diesen Stub-Wert. Seed-Accounts bleiben dagegen
    // mit leerem auth_config "pending" und melden so missing_credentials.
    const authConfig = JSON.stringify({ stub: true });
    try {
      await this.db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(integration.id, integration.projectId, integration.provider, integration.status, integration.sourceConfidence, authConfig, integration.quotaRemaining, integration.freshness, now, now);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_integration", "Integration already exists or project is unknown");
    }
    await this.audit("system", "integration.create", "integration_account", integration.id, { projectId, provider });
    return integration;
  }

  async runConnectorSync(integrationId: string, options: ConnectorSyncOptions = {}): Promise<ConnectorSyncResult> {
    const row = await this.db.prepare(`SELECT * FROM integration_accounts WHERE id = ?`).get(integrationId);
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
      const site = await this.db.prepare(`SELECT 1 FROM sites WHERE id = ? AND project_id = ?`).get(options.siteId, integration.projectId);
      if (!site) {
        throw new RequestError(404, "unknown_site", "Site not found for integration project");
      }
      entityType = "site";
      entityId = options.siteId;
    }

    const now = new Date().toISOString();
    const hasCredentials = this.hasCredentials(row as Record<string, unknown>);
    const ctx = { projectId: integration.projectId, integrationId, now, entityType, entityId, hasCredentials };
    try {
      const fetched = connector.fetch(ctx);

      // Fehlermodi (missing_credentials/quota_exceeded/expired/degraded) sind KEIN Crash:
      // sie werden als sichtbarer, abfragbarer degraded-Status persistiert und als typisiertes
      // Ergebnis zurückgegeben. So sieht UI/Agent den blockierten Zustand statt einer 502.
      if (fetched.outcome !== "ok") {
        await this.db.prepare(`UPDATE integration_accounts SET status = 'degraded', updated_at = ? WHERE id = ?`).run(now, integrationId);
        await this.audit("system", "integration.sync_degraded", "integration_account", integrationId, { provider: integration.provider, outcome: fetched.outcome, reason: fetched.reason });
        const view = await this.getIntegration(integrationId);
        if (!view.contract) {
          throw new RequestError(500, "integration_reload_failed", "Integration could not be reloaded after sync");
        }
        return {
          integration: { id: view.id, projectId: view.projectId, provider: view.provider, status: view.status, sourceConfidence: view.sourceConfidence, quotaRemaining: view.quotaRemaining, freshness: view.freshness },
          outcome: fetched.outcome,
          rawEventId: null,
          normalizedMetricsInserted: 0,
          contract: view.contract,
          reason: fetched.reason
        };
      }

      connector.validate(fetched.payload);
      const metrics = connector.normalize(fetched.payload, ctx);
      const rawEventId = `raw-${randomUUID()}`;

      await this.db.transaction(async (tx) => {
        // Rohdaten unverändert und getrennt von normalisierten Metriken speichern (§2.7, §3.2).
        await tx.prepare(`INSERT INTO raw_events (id, integration_account_id, source_type, source_confidence, payload, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(rawEventId, integrationId, connector.sourceType, connector.sourceConfidence, JSON.stringify(fetched.payload), now);
        const insertMetric = tx.prepare(`INSERT INTO normalized_metrics (id, raw_event_id, project_id, metric, entity_type, entity_id, value, measured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const metric of metrics) {
          await insertMetric.run(`nm-${randomUUID()}`, rawEventId, integration.projectId, metric.metric, metric.entityType, metric.entityId, metric.value, metric.measuredAt, connector.sourceConfidence);
        }
        await tx.prepare(`UPDATE integration_accounts SET status = 'connected', quota_remaining = ?, freshness = ?, updated_at = ? WHERE id = ?`)
          .run(fetched.quotaRemaining, fetched.freshness, now, integrationId);
      });

      await this.audit("system", "integration.sync", "integration_account", integrationId, { provider: integration.provider, metrics: metrics.length });
      const view = await this.getIntegration(integrationId);
      if (!view.contract) {
        throw new RequestError(500, "integration_reload_failed", "Integration could not be reloaded after sync");
      }
      return {
        integration: { id: view.id, projectId: view.projectId, provider: view.provider, status: view.status, sourceConfidence: view.sourceConfidence, quotaRemaining: view.quotaRemaining, freshness: view.freshness },
        outcome: "ok",
        rawEventId,
        normalizedMetricsInserted: metrics.length,
        contract: view.contract
      };
    } catch (error) {
      if (error instanceof RequestError) {
        throw error;
      }
      await this.db.prepare(`UPDATE integration_accounts SET status = 'error', updated_at = ? WHERE id = ?`).run(now, integrationId);
      await this.audit("system", "integration.sync_error", "integration_account", integrationId, { provider: integration.provider, message: error instanceof Error ? error.message : String(error) });
      throw new RequestError(502, "connector_sync_failed", error instanceof Error ? error.message : "Connector sync failed");
    }
  }

  async listSiteWebVitals(projectId: string, siteId: string): Promise<WebVitalMetric[]> {
    const site = await this.db.prepare(`SELECT 1 FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!site) {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
    // Neueste Web-Vitals-Metrik (PSI) je Kennzahl für die Site.
    const rows = await this.db.prepare(`SELECT metric, value, measured_at, source_confidence FROM normalized_metrics WHERE project_id = ? AND entity_type = 'site' AND entity_id = ? AND metric LIKE 'psi\\_%' ESCAPE '\\' ORDER BY measured_at DESC`).all(projectId, siteId);
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
