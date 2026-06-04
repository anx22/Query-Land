import { randomUUID } from "node:crypto";
import { makeIdempotencyKey, type FoundationJob } from "@seo-tool/domain-model";
import { mapJob } from "../sqlite-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError, sqliteConstraintError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

export interface JobStore {
  listJobs(): FoundationJob[];
  createJob(projectId: string, type: FoundationJob["type"], subject: string, payload?: Record<string, unknown>): { job: FoundationJob; idempotent: boolean };
  claimNextJob(type?: FoundationJob["type"]): FoundationJob | null;
  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): FoundationJob;
}

export function createJobStore(db: SQLiteDatabase, audit: AuditLog): JobStore {
  return new SQLiteJobStore(db, audit);
}

class SQLiteJobStore implements JobStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

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
      this.db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(job.id, job.projectId, job.type, job.status, job.idempotencyKey, JSON.stringify(job.payload), job.attempts, now, job.createdAt, job.updatedAt);
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
    this.db.prepare(`UPDATE job_queue SET status = 'running', attempts = attempts + 1, started_at = ?, updated_at = ? WHERE id = ? AND status = 'queued'`).run(now, now, String(row.id));
    const claimed = this.db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(String(row.id));
    return claimed ? mapJob(claimed) : null;
  }

  completeJob(jobId: string, status: "succeeded" | "failed", lastError?: string): FoundationJob {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE job_queue SET status = ?, finished_at = ?, updated_at = ?, last_error = ? WHERE id = ?`).run(status, now, now, lastError ?? null, jobId);
    const row = this.db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(jobId);
    if (!row) {
      throw new RequestError(404, "job_not_found", "Job not found", { jobId });
    }
    return mapJob(row);
  }
}
