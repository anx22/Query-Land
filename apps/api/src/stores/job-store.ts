import { randomUUID } from "node:crypto";
import { makeConnectorSyncJobSubject, makeIdempotencyKey, type FoundationJob } from "@seo-tool/domain-model";
import { mapJob } from "../sqlite-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError, sqliteConstraintError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export interface ScheduleConnectorSyncOptions {
  siteId?: string;
  now?: () => Date;
}

export interface JobStore {
  listJobs(): Promise<FoundationJob[]>;
  createJob(projectId: string, type: FoundationJob["type"], subject: string, payload?: Record<string, unknown>): Promise<{ job: FoundationJob; idempotent: boolean }>;
  scheduleConnectorSync(integrationId: string, options?: ScheduleConnectorSyncOptions): Promise<{ job: FoundationJob; idempotent: boolean }>;
  claimNextJob(type?: FoundationJob["type"]): Promise<FoundationJob | null>;
  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): Promise<FoundationJob>;
}

export interface JobStoreOptions {
  /** A 'running' job older than this is treated as abandoned and re-claimable. */
  staleRunningMs?: number;
  /** Attempts after which an abandoned job is dead-lettered (status 'failed'). */
  maxAttempts?: number;
  now?: () => Date;
}

const DEFAULT_STALE_RUNNING_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 3;

export function createJobStore(db: AsyncDatabase, audit: AuditLog, options: JobStoreOptions = {}): JobStore {
  return new SQLiteJobStore(db, audit, options);
}

class SQLiteJobStore implements JobStore {
  private readonly staleRunningMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => Date;

  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog, options: JobStoreOptions = {}) {
    this.staleRunningMs = options.staleRunningMs ?? DEFAULT_STALE_RUNNING_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.now = options.now ?? (() => new Date());
  }

  async listJobs(): Promise<FoundationJob[]> {
    return (await this.db.prepare(`SELECT * FROM job_queue ORDER BY created_at ASC`).all()).map(mapJob);
  }

  async createJob(projectId: string, type: FoundationJob["type"], subject: string, payload: Record<string, unknown> = {}): Promise<{ job: FoundationJob; idempotent: boolean }> {
    const idempotencyKey = makeIdempotencyKey(projectId, type, subject);
    const existingJob = await this.db.prepare(`SELECT * FROM job_queue WHERE idempotency_key = ?`).get(idempotencyKey);
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
      await this.db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(job.id, job.projectId, job.type, job.status, job.idempotencyKey, JSON.stringify(job.payload), job.attempts, now, job.createdAt, job.updatedAt);
    } catch (error) {
      throw sqliteConstraintError(error, "job_write_failed", "Job could not be stored");
    }
    await this.audit("system", "job.create", "job_queue", job.id, { projectId, type, subject });
    return { job, idempotent: false };
  }

  async scheduleConnectorSync(integrationId: string, options: ScheduleConnectorSyncOptions = {}): Promise<{ job: FoundationJob; idempotent: boolean }> {
    const row = await this.db.prepare(`SELECT project_id FROM integration_accounts WHERE id = ?`).get(integrationId);
    if (!row) {
      throw new RequestError(404, "unknown_integration", "Integration not found");
    }
    const projectId = String(row.project_id);
    const day = (options.now ? options.now() : this.now()).toISOString().slice(0, 10);
    const subject = makeConnectorSyncJobSubject(integrationId, day, options.siteId);
    return this.createJob(projectId, "connector_sync", subject, options.siteId ? { integrationId, siteId: options.siteId } : { integrationId });
  }

  async claimNextJob(type?: FoundationJob["type"]): Promise<FoundationJob | null> {
    const nowDate = this.now();
    const now = nowDate.toISOString();
    const staleThreshold = new Date(nowDate.getTime() - this.staleRunningMs).toISOString();

    // Dead-letter jobs that were claimed but never finished (worker crash or
    // serverless timeout) and have already exhausted their attempts, so they
    // stop blocking the queue instead of sitting in 'running' forever.
    await this.db
      .prepare(`UPDATE job_queue SET status = 'failed', finished_at = ?, updated_at = ?, last_error = ? WHERE status = 'running' AND started_at IS NOT NULL AND started_at < ? AND attempts >= ?`)
      .run(now, now, "abandoned: max attempts exceeded after timeout", staleThreshold, this.maxAttempts);

    // Claimable = queued, or a stale 'running' job still under the attempt cap
    // (re-claim after a crash/timeout instead of stranding it).
    const claimable = `(status = 'queued' OR (status = 'running' AND started_at IS NOT NULL AND started_at < ? AND attempts < ?))`;
    const row = type
      ? await this.db.prepare(`SELECT * FROM job_queue WHERE job_type = ? AND ${claimable} ORDER BY scheduled_at ASC, created_at ASC LIMIT 1`).get(type, staleThreshold, this.maxAttempts)
      : await this.db.prepare(`SELECT * FROM job_queue WHERE ${claimable} ORDER BY scheduled_at ASC, created_at ASC LIMIT 1`).get(staleThreshold, this.maxAttempts);
    if (!row) return null;

    // Optimistic claim: only succeed if the row is unchanged since we read it,
    // so two concurrent workers can never claim the same job.
    const result = await this.db
      .prepare(`UPDATE job_queue SET status = 'running', attempts = attempts + 1, started_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`)
      .run(now, now, String(row.id), String(row.updated_at));
    if (result.changes === 0) {
      return null; // lost the race; the next poll picks it up
    }
    const claimed = await this.db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(String(row.id));
    return claimed ? mapJob(claimed) : null;
  }

  async completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): Promise<FoundationJob> {
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE job_queue SET status = ?, finished_at = ?, updated_at = ?, last_error = ? WHERE id = ?`).run(status, now, now, lastError ?? null, jobId);
    const row = await this.db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(jobId);
    if (!row) {
      throw new RequestError(404, "job_not_found", "Job not found", { jobId });
    }
    return mapJob(row);
  }
}
