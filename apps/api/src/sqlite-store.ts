import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { calculateHealthScore, makeIdempotencyKey, normalizeEmail, sourceConfidenceForProvider, validateBusinessValue, validatePassword, type AuditIssueRecord, type AuthUser, type CrawlHealthScore, type CrawlRun, type DiscoveredUrl, type FoundationJob, type HealthSnapshot, type IndexabilityRecord, type IntegrationAccount, type IntegrationProvider, type Project, type Site, type SourceMapEntry, type UrlFetchRecord, type UserRole } from "@seo-tool/domain-model";
import { apiDefaults } from "@seo-tool/shared-config";
import { hashPassword, hashToken, verifyPassword } from "./password.js";
import { runSQLiteMigrations } from "./sqlite-migrations.js";
import { countIssueSeverities, emptyCrawlRunSummary, mapAuditIssueRecord, mapCrawlHealthScore, mapCrawlRun, mapDiscoveredUrl, mapIndexabilityRecord, mapIntegration, mapJob, mapProject, mapSite, mapSourceMapEntry, mapUrlFetchRecord, mapUser } from "./sqlite-mappers.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (location: string) => SQLiteDatabase;
};

interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
  close(): void;
}

interface SQLiteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Array<Record<string, unknown>>;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}

export interface LoginResult {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

export interface BackendStore {
  health(): HealthSnapshot;
  registerUser(input: RegisterInput): AuthUser;
  login(email: string, password: string): LoginResult | null;
  getUserBySessionToken(token: string): AuthUser | null;
  invalidateSessionToken(token: string): boolean;
  cleanupExpiredSessions(now?: string): number;
  listProjects(): Project[];
  createProject(input: Partial<Project>): Project;
  listSites(projectId: string): Site[];
  createSite(projectId: string, input: Partial<Site>): Site;
  listCrawlRuns(projectId: string, siteId: string): CrawlRun[];
  createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): CrawlRun;
  completeCrawlRun(projectId: string, siteId: string, runId: string, status: Extract<CrawlRun["status"], "succeeded" | "failed">, errorMessage?: string): CrawlRun;
  listHealthScores(projectId: string, siteId: string): CrawlHealthScore[];
  computeHealthScore(projectId: string, siteId: string): CrawlHealthScore;
  listAuditIssues(projectId: string, siteId: string): AuditIssueRecord[];
  recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[]): { issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number };
  resolveAuditIssue(projectId: string, siteId: string, issueId: string): AuditIssueRecord;
  listDiscoveredUrls(projectId: string, siteId?: string): DiscoveredUrl[];
  recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): { urls: DiscoveredUrl[]; inserted: number; updated: number };
  listFetchResults(projectId: string, siteId: string, discoveredUrlId: string): UrlFetchRecord[];
  recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): UrlFetchRecord;
  listIndexabilityAssessments(projectId: string, siteId: string, discoveredUrlId: string): IndexabilityRecord[];
  recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): IndexabilityRecord;
  listIntegrations(): IntegrationAccount[];
  createIntegration(projectId: string, provider: IntegrationProvider): IntegrationAccount;
  listJobs(): FoundationJob[];
  createJob(projectId: string, type: FoundationJob["type"], subject: string, payload?: Record<string, unknown>): { job: FoundationJob; idempotent: boolean };
  claimNextJob(type?: FoundationJob["type"]): FoundationJob | null;
  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): FoundationJob;
  listSourceMapEntries(): SourceMapEntry[];
  close(): void;
}

export function createSQLiteStore(databaseUrl = apiDefaults.databaseUrl): BackendStore {
  const location = sqliteLocation(databaseUrl);
  if (location !== ":memory:") {
    mkdirSync(dirname(location), { recursive: true });
  }
  const db = new DatabaseSync(location);
  runSQLiteMigrations(db);
  seedFoundation(db);
  return new SQLiteStore(db, location);
}

class SQLiteStore implements BackendStore {
  constructor(private readonly db: SQLiteDatabase, private readonly location: string) {}

  health(): HealthSnapshot {
    return {
      status: "ok",
      service: "api",
      version: apiDefaults.version,
      checkedAt: new Date().toISOString(),
      checks: [
        { name: "http", status: "ok" },
        { name: "sqlite", status: "ok", details: this.location },
        { name: "auth_tables", status: "ok", details: "users and sessions are stored in the embedded backend." },
        { name: "raw_normalized_contract", status: "ok", details: "raw_events and normalized_metrics are separate tables." }
      ]
    };
  }

  registerUser(input: RegisterInput): AuthUser {
    const email = normalizeEmail(input.email);
    const password = validatePassword(input.password);
    const now = new Date().toISOString();
    const user: AuthUser = {
      id: `usr-${randomUUID()}`,
      email,
      name: input.name?.trim() || email.split("@")[0],
      role: input.role ?? "owner",
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    try {
      this.db.prepare(`INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(user.id, user.email, user.name, hashPassword(password), user.role, user.status, user.createdAt, user.updatedAt);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_email", "Email already exists");
    }
    this.audit(user.id, "auth.register", "user", user.id, { role: user.role });
    return user;
  }

  login(email: string, password: string): LoginResult | null {
    const normalizedEmail = normalizeEmail(email);
    const row = this.db.prepare(`SELECT * FROM users WHERE email = ? AND status = 'active'`).get(normalizedEmail);
    if (!row || !verifyPassword(password, String(row.password_hash))) {
      return null;
    }
    const token = `seo_${randomUUID()}_${randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const sessionId = `ses-${randomUUID()}`;
    this.db.prepare(`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(sessionId, String(row.id), hashToken(token), expiresAt, now.toISOString());
    this.audit(String(row.id), "auth.login", "session", sessionId, { expiresAt });
    return { user: mapUser(row), token, expiresAt };
  }

  getUserBySessionToken(token: string): AuthUser | null {
    const row = this.db.prepare(`
      SELECT users.*
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.status = 'active'
    `).get(hashToken(token), new Date().toISOString());
    return row ? mapUser(row) : null;
  }

  invalidateSessionToken(token: string): boolean {
    const result = this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
    return result.changes > 0;
  }

  cleanupExpiredSessions(now = new Date().toISOString()): number {
    const result = this.db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now);
    return result.changes;
  }

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
      this.db.prepare(`INSERT INTO projects (id, name, slug, status, default_locale, markets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(project.id, project.name, project.slug, project.status, project.defaultLocale, JSON.stringify(project.markets), project.createdAt, project.updatedAt);
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
      this.db.prepare(`INSERT INTO sites (id, project_id, scope_type, base_url, crawl_frequency, business_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(site.id, site.projectId, site.scopeType, site.baseUrl, site.crawlFrequency, site.businessValue, new Date().toISOString());
    } catch (error) {
      throw sqliteConstraintError(error, "site_write_failed", "Site could not be stored");
    }
    this.audit("system", "site.create", "site", site.id, { projectId, baseUrl: site.baseUrl });
    return site;
  }

  listCrawlRuns(projectId: string, siteId: string): CrawlRun[] {
    return this.db.prepare(`SELECT * FROM crawl_runs WHERE project_id = ? AND site_id = ? ORDER BY started_at DESC`).all(projectId, siteId).map(mapCrawlRun);
  }

  createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): CrawlRun {
    this.assertSiteScope(projectId, siteId);
    const now = new Date().toISOString();
    const run: CrawlRun = {
      id: `crawl-${randomUUID()}`,
      projectId,
      siteId,
      status: "running",
      trigger,
      startedAt: now,
      finishedAt: null,
      summary: emptyCrawlRunSummary()
    };
    this.db.prepare(`
      INSERT INTO crawl_runs (id, project_id, site_id, status, trigger, started_at, finished_at, summary, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(run.id, projectId, siteId, run.status, run.trigger, run.startedAt, run.finishedAt, JSON.stringify(run.summary), null);
    this.audit("system", "crawl.run.create", "crawl_run", run.id, { projectId, siteId, trigger });
    return run;
  }

  completeCrawlRun(projectId: string, siteId: string, runId: string, status: Extract<CrawlRun["status"], "succeeded" | "failed">, errorMessage?: string): CrawlRun {
    const summary = this.crawlRunSummary(projectId, siteId);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE crawl_runs
      SET status = ?, finished_at = ?, summary = ?, error_message = ?
      WHERE id = ? AND project_id = ? AND site_id = ?
    `).run(status, now, JSON.stringify(summary), errorMessage ?? null, runId, projectId, siteId);
    const row = this.db.prepare(`SELECT * FROM crawl_runs WHERE id = ? AND project_id = ? AND site_id = ?`).get(runId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "crawl_run_not_found", "Crawl run not found", { projectId, siteId, runId });
    }
    this.audit("system", "crawl.run.complete", "crawl_run", runId, { projectId, siteId, status });
    return mapCrawlRun(row);
  }

  listHealthScores(projectId: string, siteId: string): CrawlHealthScore[] {
    return this.db.prepare(`SELECT * FROM crawl_health_scores WHERE project_id = ? AND site_id = ? ORDER BY generated_at DESC`).all(projectId, siteId).map(mapCrawlHealthScore);
  }

  computeHealthScore(projectId: string, siteId: string): CrawlHealthScore {
    this.assertSiteScope(projectId, siteId);
    const openIssues = this.listAuditIssues(projectId, siteId).filter((issue) => issue.resolvedAt === null);
    const issueCounts = countIssueSeverities(openIssues);
    const score: CrawlHealthScore = {
      id: `health-${randomUUID()}`,
      projectId,
      siteId,
      score: calculateHealthScore(openIssues),
      totalIssues: openIssues.length,
      issueCounts,
      generatedAt: new Date().toISOString()
    };
    this.db.prepare(`
      INSERT INTO crawl_health_scores (id, project_id, site_id, score, total_issues, issue_counts, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(score.id, projectId, siteId, score.score, score.totalIssues, JSON.stringify(score.issueCounts), score.generatedAt);
    this.audit("system", "crawl.health.compute", "site", siteId, { projectId, score: score.score, totalIssues: score.totalIssues });
    return score;
  }

  listAuditIssues(projectId: string, siteId: string): AuditIssueRecord[] {
    return this.db.prepare(`SELECT * FROM audit_issues WHERE project_id = ? AND site_id = ? ORDER BY detected_at DESC, severity ASC`).all(projectId, siteId).map(mapAuditIssueRecord);
  }

  recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[]): { issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number } {
    this.assertSiteScope(projectId, siteId);
    for (const issue of issues) {
      if (issue.projectId !== projectId || issue.siteId !== siteId) {
        throw new RequestError(400, "issue_scope_mismatch", "Audit issue projectId/siteId must match the route scope", { issueId: issue.id });
      }
      if (issue.discoveredUrlId) {
        this.assertDiscoveredUrlScope(projectId, siteId, issue.discoveredUrlId);
      }
    }

    let inserted = 0;
    let updated = 0;
    let resolved = 0;
    const now = new Date().toISOString();
    const submittedIssueIds = new Set(issues.map((issue) => issue.id));
    const openIssueIds = this.db.prepare(`SELECT id FROM audit_issues WHERE project_id = ? AND site_id = ? AND resolved_at IS NULL`).all(projectId, siteId).map((row) => String(row.id));
    const staleIssueIds = openIssueIds.filter((id) => !submittedIssueIds.has(id));
    if (staleIssueIds.length > 0) {
      const resolveStaleIssue = this.db.prepare(`UPDATE audit_issues SET resolved_at = ?, updated_at = ? WHERE id = ? AND project_id = ? AND site_id = ? AND resolved_at IS NULL`);
      for (const issueId of staleIssueIds) {
        const result = resolveStaleIssue.run(now, now, issueId, projectId, siteId);
        resolved += Number(result.changes ?? 0);
      }
    }

    for (const issue of issues) {
      const existing = this.db.prepare(`SELECT id FROM audit_issues WHERE id = ?`).get(issue.id);
      this.db.prepare(`
        INSERT INTO audit_issues (id, project_id, site_id, discovered_url_id, url, rule, severity, message, detected_at, resolved_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          discovered_url_id = excluded.discovered_url_id,
          url = excluded.url,
          rule = excluded.rule,
          severity = excluded.severity,
          message = excluded.message,
          detected_at = excluded.detected_at,
          resolved_at = excluded.resolved_at,
          updated_at = excluded.updated_at
      `).run(issue.id, projectId, siteId, issue.discoveredUrlId, issue.url, issue.rule, issue.severity, issue.message, issue.detectedAt, issue.resolvedAt, now);
      existing ? updated += 1 : inserted += 1;
    }
    const stored = this.listAuditIssues(projectId, siteId);
    this.audit("system", "crawl.issues.record", "site", siteId, { projectId, inserted, updated, resolved, total: stored.length });
    return { issues: stored, inserted, updated, resolved };
  }

  resolveAuditIssue(projectId: string, siteId: string, issueId: string): AuditIssueRecord {
    this.assertSiteScope(projectId, siteId);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE audit_issues
      SET resolved_at = COALESCE(resolved_at, ?), updated_at = ?
      WHERE id = ? AND project_id = ? AND site_id = ?
    `).run(now, now, issueId, projectId, siteId);
    const row = this.db.prepare(`SELECT * FROM audit_issues WHERE id = ? AND project_id = ? AND site_id = ?`).get(issueId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "audit_issue_not_found", "Audit issue not found", { projectId, siteId, issueId });
    }
    this.audit("system", "crawl.issue.resolve", "audit_issue", issueId, { projectId, siteId });
    return mapAuditIssueRecord(row);
  }

  listDiscoveredUrls(projectId: string, siteId?: string): DiscoveredUrl[] {
    const sql = siteId
      ? `SELECT * FROM discovered_urls WHERE project_id = ? AND site_id = ? ORDER BY discovered_at ASC, normalized_url ASC`
      : `SELECT * FROM discovered_urls WHERE project_id = ? ORDER BY discovered_at ASC, normalized_url ASC`;
    const rows = siteId
      ? this.db.prepare(sql).all(projectId, siteId)
      : this.db.prepare(sql).all(projectId);
    return rows.map(mapDiscoveredUrl);
  }

  recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): { urls: DiscoveredUrl[]; inserted: number; updated: number } {
    const site = this.db.prepare(`SELECT id FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!site) {
      throw new RequestError(404, "unknown_site", "Referenced site does not exist", { projectId, siteId });
    }

    let inserted = 0;
    let updated = 0;
    const now = new Date().toISOString();

    for (const url of urls) {
      if (url.projectId !== projectId || url.siteId !== siteId) {
        throw new RequestError(400, "url_scope_mismatch", "Discovered URL projectId/siteId must match the route scope", { url: url.normalizedUrl });
      }
      const existing = this.db.prepare(`SELECT id FROM discovered_urls WHERE project_id = ? AND site_id = ? AND normalized_url = ?`)
        .get(projectId, siteId, url.normalizedUrl);
      this.db.prepare(`
        INSERT INTO discovered_urls (id, project_id, site_id, url, normalized_url, source, discovered_from, depth, discovered_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, site_id, normalized_url) DO UPDATE SET
          url = excluded.url,
          source = excluded.source,
          discovered_from = excluded.discovered_from,
          depth = excluded.depth,
          discovered_at = excluded.discovered_at,
          updated_at = excluded.updated_at
      `).run(url.id, projectId, siteId, url.url, url.normalizedUrl, url.source, url.discoveredFrom, url.depth, url.discoveredAt, now);
      if (existing) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    const stored = this.listDiscoveredUrls(projectId, siteId);
    this.audit("system", "crawl.discovery.record", "site", siteId, { projectId, inserted, updated, total: stored.length });
    return { urls: stored, inserted, updated };
  }

  listFetchResults(projectId: string, siteId: string, discoveredUrlId: string): UrlFetchRecord[] {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    return this.db.prepare(`
      SELECT * FROM url_fetch_results
      WHERE project_id = ? AND site_id = ? AND discovered_url_id = ?
      ORDER BY fetched_at DESC, created_at DESC
    `).all(projectId, siteId, discoveredUrlId).map(mapUrlFetchRecord);
  }

  recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): UrlFetchRecord {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    const id = `fetch-${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO url_fetch_results (id, project_id, site_id, discovered_url_id, url, final_url, status_code, status_class, headers, redirect_chain, fetched_at, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      siteId,
      discoveredUrlId,
      result.url,
      result.finalUrl,
      result.statusCode,
      result.statusClass,
      JSON.stringify(result.headers),
      JSON.stringify(result.redirectChain),
      result.fetchedAt,
      result.errorMessage ?? null,
      now
    );
    this.audit("system", "crawl.fetch.record", "discovered_url", discoveredUrlId, { projectId, siteId, statusClass: result.statusClass, statusCode: result.statusCode });
    const row = this.db.prepare(`SELECT * FROM url_fetch_results WHERE id = ?`).get(id);
    if (!row) {
      throw new RequestError(400, "fetch_result_write_failed", "Fetch result could not be stored");
    }
    return mapUrlFetchRecord(row);
  }

  listIndexabilityAssessments(projectId: string, siteId: string, discoveredUrlId: string): IndexabilityRecord[] {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    return this.db.prepare(`
      SELECT * FROM url_indexability_assessments
      WHERE project_id = ? AND site_id = ? AND discovered_url_id = ?
      ORDER BY assessed_at DESC, created_at DESC
    `).all(projectId, siteId, discoveredUrlId).map(mapIndexabilityRecord);
  }

  recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): IndexabilityRecord {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    if (assessment.fetchResultId) {
      this.assertFetchResultScope(projectId, siteId, discoveredUrlId, assessment.fetchResultId);
    }
    const id = `index-${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO url_indexability_assessments (id, project_id, site_id, discovered_url_id, fetch_result_id, url, state, is_indexable, reasons, canonical_url, assessed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      siteId,
      discoveredUrlId,
      assessment.fetchResultId,
      assessment.url,
      assessment.state,
      assessment.isIndexable ? 1 : 0,
      JSON.stringify(assessment.reasons),
      assessment.canonicalUrl,
      assessment.assessedAt,
      now
    );
    this.audit("system", "crawl.indexability.record", "discovered_url", discoveredUrlId, { projectId, siteId, state: assessment.state, isIndexable: assessment.isIndexable });
    const row = this.db.prepare(`SELECT * FROM url_indexability_assessments WHERE id = ?`).get(id);
    if (!row) {
      throw new RequestError(400, "indexability_write_failed", "Indexability assessment could not be stored");
    }
    return mapIndexabilityRecord(row);
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
      this.db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`)
        .run(integration.id, integration.projectId, integration.provider, integration.status, integration.sourceConfidence, integration.quotaRemaining, integration.freshness, now, now);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_integration", "Integration already exists or project is unknown");
    }
    this.audit("system", "integration.create", "integration_account", integration.id, { projectId, provider });
    return integration;
  }

  listJobs(): FoundationJob[] {
    return this.db.prepare(`SELECT * FROM job_queue ORDER BY created_at ASC`).all().map(mapJob);
  }

  createJob(projectId: string, type: FoundationJob["type"], subject: string, payload: Record<string, unknown> = {}): { job: FoundationJob; idempotent: boolean } {
    const idempotencyKey = makeIdempotencyKey(projectId, type, subject);
    const existingJob = this.db.prepare(`SELECT * FROM job_queue WHERE idempotency_key = ?`).get(idempotencyKey);
    if (existingJob) {
      return { job: mapJob(existingJob), idempotent: true };
    }
    const now = new Date().toISOString();
    const job: FoundationJob = {
      id: `job-${randomUUID()}`,
      projectId,
      type,
      status: "queued",
      idempotencyKey,
      subject,
      payload: { ...payload, subject },
      attempts: 0,
      createdAt: now,
      updatedAt: now
    };
    try {
      this.db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(job.id, job.projectId, job.type, job.status, job.idempotencyKey, JSON.stringify(job.payload), job.attempts, now, job.createdAt, job.updatedAt);
    } catch (error) {
      throw sqliteConstraintError(error, "job_write_failed", "Job could not be stored");
    }
    this.audit("system", "job.create", "job_queue", job.id, { projectId, type, subject });
    return { job, idempotent: false };
  }

  claimNextJob(type?: FoundationJob["type"]): FoundationJob | null {
    const row = type
      ? this.db.prepare(`SELECT * FROM job_queue WHERE status = 'queued' AND job_type = ? ORDER BY scheduled_at ASC, created_at ASC LIMIT 1`).get(type)
      : this.db.prepare(`SELECT * FROM job_queue WHERE status = 'queued' ORDER BY scheduled_at ASC, created_at ASC LIMIT 1`).get();
    if (!row) return null;
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE job_queue SET status = 'running', attempts = attempts + 1, started_at = ?, updated_at = ? WHERE id = ? AND status = 'queued'`)
      .run(now, now, String(row.id));
    const claimed = this.db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(String(row.id));
    return claimed ? mapJob(claimed) : null;
  }

  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): FoundationJob {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE job_queue SET status = ?, finished_at = ?, updated_at = ?, last_error = ? WHERE id = ?`)
      .run(status, now, now, lastError ?? null, jobId);
    const row = this.db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(jobId);
    if (!row) {
      throw new RequestError(404, "job_not_found", "Job not found", { jobId });
    }
    return mapJob(row);
  }

  listSourceMapEntries(): SourceMapEntry[] {
    return this.db.prepare(`
      SELECT url_template_map.id, url_template_map.project_id, url_template_map.url_pattern, templates.name AS template,
             templates.component, templates.repo_path, url_template_map.confidence
      FROM url_template_map
      JOIN templates ON templates.id = url_template_map.template_id
      ORDER BY url_template_map.created_at ASC
    `).all().map(mapSourceMapEntry);
  }

  close(): void {
    this.db.close();
  }

  private assertSiteScope(projectId: string, siteId: string): void {
    const row = this.db.prepare(`SELECT id FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!row) {
      throw new RequestError(404, "unknown_site", "Referenced site does not exist", { projectId, siteId });
    }
  }

  private crawlRunSummary(projectId: string, siteId: string): CrawlRun["summary"] {
    const discoveredUrls = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM discovered_urls WHERE project_id = ? AND site_id = ?`).get(projectId, siteId)?.count ?? 0);
    const fetchedUrls = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM url_fetch_results WHERE project_id = ? AND site_id = ?`).get(projectId, siteId)?.count ?? 0);
    const indexabilityAssessments = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM url_indexability_assessments WHERE project_id = ? AND site_id = ?`).get(projectId, siteId)?.count ?? 0);
    const openIssues = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM audit_issues WHERE project_id = ? AND site_id = ? AND resolved_at IS NULL`).get(projectId, siteId)?.count ?? 0);
    const healthRow = this.db.prepare(`SELECT score FROM crawl_health_scores WHERE project_id = ? AND site_id = ? ORDER BY generated_at DESC LIMIT 1`).get(projectId, siteId);
    return { discoveredUrls, fetchedUrls, indexabilityAssessments, openIssues, healthScore: healthRow ? Number(healthRow.score) : null };
  }


  private assertDiscoveredUrlScope(projectId: string, siteId: string, discoveredUrlId: string): void {
    const row = this.db.prepare(`SELECT id FROM discovered_urls WHERE id = ? AND project_id = ? AND site_id = ?`).get(discoveredUrlId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "unknown_discovered_url", "Referenced discovered URL does not exist", { projectId, siteId, discoveredUrlId });
    }
  }

  private assertFetchResultScope(projectId: string, siteId: string, discoveredUrlId: string, fetchResultId: string): void {
    const row = this.db.prepare(`
      SELECT id FROM url_fetch_results
      WHERE id = ? AND project_id = ? AND site_id = ? AND discovered_url_id = ?
    `).get(fetchResultId, projectId, siteId, discoveredUrlId);
    if (!row) {
      throw new RequestError(404, "unknown_fetch_result", "Referenced fetch result does not exist", { projectId, siteId, discoveredUrlId, fetchResultId });
    }
  }

  private audit(actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>): void {
    this.db.prepare(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(`aud-${randomUUID()}`, actorId, action, entityType, entityId, JSON.stringify(metadata), new Date().toISOString());
  }
}

export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

function sqliteConstraintError(error: unknown, fallbackCode: string, fallbackMessage: string): RequestError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("FOREIGN KEY")) {
    return new RequestError(404, "unknown_project", "Referenced project does not exist");
  }
  if (message.includes("UNIQUE")) {
    return new RequestError(409, fallbackCode, fallbackMessage);
  }
  return new RequestError(400, fallbackCode, fallbackMessage);
}

export function sqliteLocation(databaseUrl: string): string {
  if (databaseUrl === "sqlite::memory:" || databaseUrl === ":memory:") {
    return ":memory:";
  }
  if (databaseUrl.startsWith("sqlite:")) {
    return resolve(databaseUrl.slice("sqlite:".length));
  }
  return resolve(databaseUrl);
}

function seedFoundation(db: SQLiteDatabase): void {
  const now = "2026-06-02T00:00:00.000Z";
  const projectCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM projects`).get()?.count ?? 0);
  if (projectCount > 0) {
    return;
  }
  db.prepare(`INSERT INTO projects (id, name, slug, status, default_locale, markets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("proj-demo", "Demo Property", "demo-property", "active", "de-DE", JSON.stringify([{ country: "DE", language: "de", device: "desktop", searchEngine: "google" }]), now, now);
  db.prepare(`INSERT INTO sites (id, project_id, scope_type, base_url, crawl_frequency, business_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run("site-demo", "proj-demo", "domain", "https://example.com", "weekly", 80, now);
  db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`)
    .run("int-gsc-demo", "proj-demo", "gsc", "pending", "B", null, null, now, now);
  db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`)
    .run("int-ga4-demo", "proj-demo", "ga4", "pending", "A", null, null, now, now);
  db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("job-source-map-refresh-demo", "proj-demo", "source_map_refresh", "queued", "proj-demo:source_map_refresh:demo-property", JSON.stringify({ subject: "demo-property" }), 0, now, now, now);
  db.prepare(`INSERT INTO source_repos (id, project_id, repo_url, default_branch, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run("repo-demo", "proj-demo", "file://.", "main", now);
  db.prepare(`INSERT INTO templates (id, source_repo_id, name, component, repo_path) VALUES (?, ?, ?, ?, ?)`)
    .run("tpl-home-demo", "repo-demo", "home-page", "HomePage", "apps/web/app/page.tsx");
  db.prepare(`INSERT INTO url_template_map (id, project_id, url_pattern, template_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run("srcmap-home-demo", "proj-demo", "/", "tpl-home-demo", "exact", now);
  db.prepare(`INSERT INTO feature_flags (key, enabled, description) VALUES (?, ?, ?)`)
    .run("auth.email_password", 1, "Enable local backend-owned email/password sessions.");
}
