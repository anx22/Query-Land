import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "../src/db/index.js";
import { runMigrations } from "../src/db/migrate.js";
import { createAuditLog } from "../src/stores/audit-log.js";
import { createJobStore } from "../src/stores/job-store.js";

async function freshStore() {
  const db = await createDatabase("sqlite::memory:");
  await runMigrations(db);
  // job_queue.project_id references projects(id); seed one to satisfy the FK.
  const ts = "2026-01-01T00:00:00.000Z";
  await db.prepare(`INSERT INTO projects (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run("p1", "P1", "p1", ts, ts);
  return { db, store: createJobStore(db, createAuditLog(db)) };
}

// Far in the past, so it falls outside any reasonable stale-running window.
const LONG_AGO = "2000-01-01T00:00:00.000Z";

test("reclaims a stale running job after a worker timeout", async () => {
  const { db, store } = await freshStore();
  try {
    const { job } = await store.createJob("p1", "crawl_seed", "s1");
    const first = await store.claimNextJob("crawl_seed");
    assert.equal(first?.id, job.id);
    assert.equal(first?.attempts, 1);
    assert.equal(first?.status, "running");

    // Simulate the worker dying mid-crawl: stuck 'running', started long ago.
    await db.prepare(`UPDATE job_queue SET started_at = ?, updated_at = ? WHERE id = ?`).run(LONG_AGO, LONG_AGO, job.id);

    const reclaimed = await store.claimNextJob("crawl_seed");
    assert.equal(reclaimed?.id, job.id);
    assert.equal(reclaimed?.attempts, 2);
    assert.equal(reclaimed?.status, "running");
  } finally {
    await db.close();
  }
});

test("does not reclaim a freshly running job", async () => {
  const { db, store } = await freshStore();
  try {
    await store.createJob("p1", "crawl_seed", "s1");
    await store.claimNextJob("crawl_seed");
    assert.equal(await store.claimNextJob("crawl_seed"), null);
  } finally {
    await db.close();
  }
});

test("dead-letters a stale running job that exhausted its attempts", async () => {
  const { db, store } = await freshStore();
  try {
    const { job } = await store.createJob("p1", "crawl_seed", "s1");
    // Stuck 'running', old, already at the attempt cap.
    await db.prepare(`UPDATE job_queue SET status = 'running', attempts = 3, started_at = ?, updated_at = ? WHERE id = ?`).run(LONG_AGO, LONG_AGO, job.id);

    assert.equal(await store.claimNextJob("crawl_seed"), null);

    const row = await db.prepare(`SELECT status, last_error FROM job_queue WHERE id = ?`).get(job.id);
    assert.equal(row?.status, "failed");
    assert.match(String(row?.last_error), /abandoned/);
  } finally {
    await db.close();
  }
});

test("still claims a queued job normally", async () => {
  const { db, store } = await freshStore();
  try {
    const { job } = await store.createJob("p1", "crawl_seed", "s1");
    const claimed = await store.claimNextJob("crawl_seed");
    assert.equal(claimed?.id, job.id);
    assert.equal(claimed?.status, "running");
    assert.equal(claimed?.attempts, 1);
  } finally {
    await db.close();
  }
});
