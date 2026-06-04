import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { calculateHealthScore, DomainValidationError, makeIdempotencyKey, normalizeEmail, sourceConfidenceForProvider, validateBusinessValue, validatePassword, type AuditIssueRecord, type AuthUser, type CrawlHealthScore, type CrawlRun, type DiscoveredUrl, type FoundationJob, type HealthSnapshot, type IndexabilityRecord, type IntegrationAccount, type IntegrationProvider, type Project, type Site, type SourceMapEntry, type UrlFetchRecord, type UserRole } from "@seo-tool/domain-model";
import { apiDefaults } from "@seo-tool/shared-config";
import { createAuditLog } from "./stores/audit-log.js";
import { createAuthStore, type AuthStore } from "./stores/auth-store.js";
import { createCrawlStore, type CrawlStore } from "./stores/crawl-store.js";
import { createJobStore, type JobStore } from "./stores/job-store.js";
import { createProjectStore, type ProjectStore } from "./stores/project-store.js";
import { createSourceMapStore, type SourceMapStore } from "./stores/source-map-store.js";
import { RequestError } from "./stores/store-errors.js";
import type { SQLiteDatabase } from "./stores/sqlite-types.js";
import { seedFoundation } from "./sqlite-seed.js";
import { runSQLiteMigrations } from "./sqlite-migrations.js";

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

export interface RecordAuditIssuesScope {
  checkedDiscoveredUrlIds: string[];
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
  recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[], scope: RecordAuditIssuesScope): { issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number };
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
};

export { RequestError };
export type { AuthStore, RegisterInput, LoginResult } from "./stores/auth-store.js";
export type { CrawlStore } from "./stores/crawl-store.js";
export type { JobStore } from "./stores/job-store.js";
export type { ProjectStore } from "./stores/project-store.js";
export type { SourceMapStore } from "./stores/source-map-store.js";

export function createSQLiteStore(databaseUrl = apiDefaults.databaseUrl): SQLiteStore {
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
    const email = validateDomainInput(() => normalizeEmail(input.email));
    const password = validateDomainInput(() => validatePassword(input.password));
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
    const normalizedEmail = validateDomainInput(() => normalizeEmail(email));
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
      businessValue: validateDomainInput(() => validateBusinessValue(input.businessValue ?? 50))
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

  recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[], scope: RecordAuditIssuesScope): { issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number } {
    this.assertSiteScope(projectId, siteId);
    const checkedDiscoveredUrlIds = [...new Set(scope.checkedDiscoveredUrlIds)];
    for (const discoveredUrlId of checkedDiscoveredUrlIds) {
      this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    }
    const checkedDiscoveredUrlIdSet = new Set(checkedDiscoveredUrlIds);
    const checkedUrlRows = checkedDiscoveredUrlIds.map((discoveredUrlId) => this.db.prepare(`SELECT url, normalized_url FROM discovered_urls WHERE id = ? AND project_id = ? AND site_id = ?`).get(discoveredUrlId, projectId, siteId));
    const checkedUrlSet = new Set(checkedUrlRows.flatMap((row) => row ? [String(row.url), String(row.normalized_url)] : []));
    for (const issue of issues) {
      if (issue.projectId !== projectId || issue.siteId !== siteId) {
        throw new RequestError(400, "issue_scope_mismatch", "Audit issue projectId/siteId must match the route scope", { issueId: issue.id });
      }
      if (issue.discoveredUrlId) {
        this.assertDiscoveredUrlScope(projectId, siteId, issue.discoveredUrlId);
        if (!checkedDiscoveredUrlIdSet.has(issue.discoveredUrlId)) {
          throw new RequestError(400, "issue_scope_mismatch", "Audit issue discoveredUrlId must be included in checkedDiscoveredUrlIds", { issueId: issue.id, discoveredUrlId: issue.discoveredUrlId });
        }
      } else if (checkedDiscoveredUrlIds.length > 0 && !checkedUrlSet.has(issue.url)) {
        throw new RequestError(400, "issue_scope_mismatch", "Audit issue URL must be included in checkedDiscoveredUrlIds scope when discoveredUrlId is null", { issueId: issue.id, url: issue.url });
      }
    }

    let inserted = 0;
    let updated = 0;
    let resolved = 0;
    const now = new Date().toISOString();
    const submittedIssueIds = new Set(issues.map((issue) => issue.id));
    if (checkedDiscoveredUrlIds.length > 0) {
      const openScopedIssues = this.db.prepare(`SELECT id FROM audit_issues WHERE project_id = ? AND site_id = ? AND resolved_at IS NULL AND (discovered_url_id = ? OR url = ? OR url = ?)`);
      const staleIssueIds = [...new Set(checkedDiscoveredUrlIds.flatMap((discoveredUrlId, index) => {
        const checkedUrlRow = checkedUrlRows[index];
        return openScopedIssues.all(projectId, siteId, discoveredUrlId, String(checkedUrlRow?.url ?? ""), String(checkedUrlRow?.normalized_url ?? "")).map((row) => String(row.id));
      }))].filter((id) => !submittedIssueIds.has(id));
      if (staleIssueIds.length > 0) {
        const resolveStaleIssue = this.db.prepare(`UPDATE audit_issues SET resolved_at = ?, updated_at = ? WHERE id = ? AND project_id = ? AND site_id = ? AND resolved_at IS NULL`);
        for (const issueId of staleIssueIds) {
          const result = resolveStaleIssue.run(now, now, issueId, projectId, siteId);
          resolved += Number(result.changes ?? 0);
        }
      }
    }
    const prototype = Object.getPrototypeOf(store) as object | null;
    if (!prototype) {
      continue;
    }
    const stored = this.listAuditIssues(projectId, siteId);
    this.audit("system", "crawl.issues.record", "site", siteId, { projectId, checkedDiscoveredUrlIds, inserted, updated, resolved, total: stored.length });
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
      const value = (prototype as Record<string, unknown>)[key as string];
      composed[key as string] = typeof value === "function" ? value.bind(store) : value;
    }
  }
  return composed as TStore;
}

export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
    this.name = "RequestError";
  }
}

function validateDomainInput<T>(validator: () => T): T {
  try {
    return validator();
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new RequestError(400, "validation_error", error.message);
    }
    throw error;
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
