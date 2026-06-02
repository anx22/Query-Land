import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { makeIdempotencyKey, normalizeEmail, sourceConfidenceForProvider, validateBusinessValue, validatePassword, type AuthUser, type FoundationJob, type HealthSnapshot, type IntegrationAccount, type IntegrationProvider, type Project, type Site, type SourceMapEntry, type UserRole } from "@seo-tool/domain-model";
import { apiDefaults } from "@seo-tool/shared-config";
import { hashPassword, hashToken, verifyPassword } from "./password.js";
import { sqliteFoundationSchema } from "./sqlite-schema.js";

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
  listIntegrations(): IntegrationAccount[];
  createIntegration(projectId: string, provider: IntegrationProvider): IntegrationAccount;
  listJobs(): FoundationJob[];
  createJob(projectId: string, type: FoundationJob["type"], subject: string): { job: FoundationJob; idempotent: boolean };
  claimNextJob(): FoundationJob | null;
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
  db.exec(sqliteFoundationSchema);
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

  createJob(projectId: string, type: FoundationJob["type"], subject: string): { job: FoundationJob; idempotent: boolean } {
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
      attempts: 0,
      createdAt: now,
      updatedAt: now
    };
    try {
      this.db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`)
        .run(job.id, job.projectId, job.type, job.status, job.idempotencyKey, job.attempts, now, job.createdAt, job.updatedAt);
    } catch (error) {
      throw sqliteConstraintError(error, "job_write_failed", "Job could not be stored");
    }
    this.audit("system", "job.create", "job_queue", job.id, { projectId, type, subject });
    return { job, idempotent: false };
  }


  claimNextJob(): FoundationJob | null {
    const row = this.db.prepare(`SELECT * FROM job_queue WHERE status = 'queued' ORDER BY scheduled_at ASC, created_at ASC LIMIT 1`).get();
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

function sqliteLocation(databaseUrl: string): string {
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
  db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`)
    .run("job-source-map-refresh-demo", "proj-demo", "source_map_refresh", "queued", "proj-demo:source_map_refresh:demo-property", 0, now, now, now);
  db.prepare(`INSERT INTO source_repos (id, project_id, repo_url, default_branch, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run("repo-demo", "proj-demo", "file://.", "main", now);
  db.prepare(`INSERT INTO templates (id, source_repo_id, name, component, repo_path) VALUES (?, ?, ?, ?, ?)`)
    .run("tpl-home-demo", "repo-demo", "home-page", "HomePage", "apps/web/app/page.tsx");
  db.prepare(`INSERT INTO url_template_map (id, project_id, url_pattern, template_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run("srcmap-home-demo", "proj-demo", "/", "tpl-home-demo", "exact", now);
  db.prepare(`INSERT INTO feature_flags (key, enabled, description) VALUES (?, ?, ?)`)
    .run("auth.email_password", 1, "Enable local backend-owned email/password sessions.");
}

function mapUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as UserRole,
    status: row.status as AuthUser["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status as Project["status"],
    defaultLocale: String(row.default_locale),
    markets: JSON.parse(String(row.markets)) as Project["markets"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapSite(row: Record<string, unknown>): Site {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    scopeType: row.scope_type as Site["scopeType"],
    baseUrl: String(row.base_url),
    crawlFrequency: row.crawl_frequency as Site["crawlFrequency"],
    businessValue: Number(row.business_value)
  };
}

function mapIntegration(row: Record<string, unknown>): IntegrationAccount {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    provider: row.provider as IntegrationProvider,
    status: row.status as IntegrationAccount["status"],
    sourceConfidence: row.source_confidence as IntegrationAccount["sourceConfidence"],
    quotaRemaining: row.quota_remaining === null ? null : Number(row.quota_remaining),
    freshness: row.freshness === null ? null : String(row.freshness)
  };
}

function mapJob(row: Record<string, unknown>): FoundationJob {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    type: row.job_type as FoundationJob["type"],
    status: row.status as FoundationJob["status"],
    idempotencyKey: String(row.idempotency_key),
    attempts: Number(row.attempts),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapSourceMapEntry(row: Record<string, unknown>): SourceMapEntry {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    urlPattern: String(row.url_pattern),
    template: String(row.template),
    component: String(row.component),
    repoPath: String(row.repo_path),
    confidence: row.confidence as SourceMapEntry["confidence"]
  };
}
