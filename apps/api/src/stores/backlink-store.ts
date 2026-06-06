import { randomUUID } from "node:crypto";
import {
  aggregateReferringDomains,
  diffBacklinks,
  summarizeAuthority,
  type AuthoritySummary,
  type Backlink,
  type BacklinkDiff,
  type BacklinkSnapshot,
  type LinkType,
  type ReferringDomain
} from "@seo-tool/domain-model";
import { getBacklinkProvider } from "../backlinks/index.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export interface BacklinkImportResult {
  snapshotId: string;
  totalBacklinks: number;
  referringDomains: number;
  capturedAt: string;
}

export interface BacklinkPage {
  data: Backlink[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface BacklinkStore {
  importBacklinks(projectId: string): BacklinkImportResult;
  listBacklinks(projectId: string, options?: { limit?: number; offset?: number }): BacklinkPage;
  listReferringDomains(projectId: string): ReferringDomain[];
  backlinkDiff(projectId: string): BacklinkDiff;
  authoritySummary(projectId: string): AuthoritySummary;
  listBacklinkSnapshots(projectId: string): BacklinkSnapshot[];
}

export function createBacklinkStore(db: SQLiteDatabase, audit: AuditLog): BacklinkStore {
  return new SQLiteBacklinkStore(db, audit);
}

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function normalizeOffset(offset?: number): number {
  if (!offset || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

class SQLiteBacklinkStore implements BacklinkStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  private requireProjectSite(projectId: string): { baseUrl: string } {
    if (!this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId)) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    const site = this.db.prepare(`SELECT base_url FROM sites WHERE project_id = ? ORDER BY created_at ASC LIMIT 1`).get(projectId) as { base_url?: string } | undefined;
    if (!site || typeof site.base_url !== "string") {
      throw new RequestError(400, "no_site", "Add a site before importing backlinks");
    }
    return { baseUrl: site.base_url };
  }

  importBacklinks(projectId: string): BacklinkImportResult {
    const { baseUrl } = this.requireProjectSite(projectId);
    const round = Number((this.db.prepare(`SELECT COUNT(*) AS c FROM backlink_snapshots WHERE project_id = ?`).get(projectId) as { c: number }).c);
    const provider = getBacklinkProvider();
    const rows = provider.fetch({ baseUrl, round });
    const capturedAt = new Date().toISOString();
    const snapshotId = `blsnap-${randomUUID()}`;
    const referringDomains = new Set(rows.map((row) => row.sourceDomain)).size;

    this.db.exec("BEGIN");
    try {
      this.db.prepare(`INSERT INTO backlink_snapshots (id, project_id, captured_at, total_backlinks, referring_domains, source_confidence) VALUES (?, ?, ?, ?, ?, ?)`).run(
        snapshotId, projectId, capturedAt, rows.length, referringDomains, provider.sourceConfidence
      );
      const insert = this.db.prepare(`INSERT INTO backlinks (id, project_id, snapshot_id, source_url, source_domain, target_url, anchor_text, link_type, first_seen_at, last_seen_at, source_confidence, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of rows) {
        insert.run(`bl-${randomUUID()}`, projectId, snapshotId, row.sourceUrl, row.sourceDomain, row.targetUrl, row.anchorText, row.linkType, capturedAt, capturedAt, provider.sourceConfidence, capturedAt);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    this.audit("system", "backlinks.import", "project", projectId, { snapshotId, totalBacklinks: rows.length, referringDomains });
    return { snapshotId, totalBacklinks: rows.length, referringDomains, capturedAt };
  }

  private latestSnapshotId(projectId: string): string | null {
    const row = this.db.prepare(`SELECT id FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, rowid DESC LIMIT 1`).get(projectId) as { id?: string } | undefined;
    return row && row.id ? String(row.id) : null;
  }

  private snapshotBacklinks(snapshotId: string): Backlink[] {
    return this.db.prepare(`SELECT * FROM backlinks WHERE snapshot_id = ? ORDER BY source_domain ASC, source_url ASC`).all(snapshotId).map((row) => this.mapBacklink(row));
  }

  listBacklinks(projectId: string, options: { limit?: number; offset?: number } = {}): BacklinkPage {
    this.assertProject(projectId);
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);
    const snapshotId = this.latestSnapshotId(projectId);
    if (!snapshotId) {
      return { data: [], limit, offset, total: 0, nextCursor: null };
    }
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS c FROM backlinks WHERE snapshot_id = ?`).get(snapshotId) as { c: number }).c);
    const rows = this.db.prepare(`SELECT * FROM backlinks WHERE snapshot_id = ? ORDER BY source_domain ASC, source_url ASC LIMIT ? OFFSET ?`).all(snapshotId, limit, offset);
    const data = rows.map((row) => this.mapBacklink(row));
    const nextOffset = offset + data.length;
    const nextCursor = nextOffset < total ? Buffer.from(`offset:${nextOffset}`, "utf8").toString("base64url") : null;
    return { data, limit, offset, total, nextCursor };
  }

  listReferringDomains(projectId: string): ReferringDomain[] {
    this.assertProject(projectId);
    const snapshotId = this.latestSnapshotId(projectId);
    if (!snapshotId) return [];
    return aggregateReferringDomains(this.snapshotBacklinks(snapshotId));
  }

  backlinkDiff(projectId: string): BacklinkDiff {
    this.assertProject(projectId);
    const snapshots = this.db.prepare(`SELECT id FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, rowid DESC LIMIT 2`).all(projectId) as Array<{ id: string }>;
    if (snapshots.length === 0) {
      throw new RequestError(404, "no_snapshots", "No backlink snapshots imported for this project");
    }
    const after = this.snapshotBacklinks(String(snapshots[0].id));
    const before = snapshots[1] ? this.snapshotBacklinks(String(snapshots[1].id)) : [];
    return diffBacklinks(before, after);
  }

  authoritySummary(projectId: string): AuthoritySummary {
    this.assertProject(projectId);
    const snapshotId = this.latestSnapshotId(projectId);
    if (!snapshotId) return summarizeAuthority([]);
    return summarizeAuthority(this.snapshotBacklinks(snapshotId));
  }

  listBacklinkSnapshots(projectId: string): BacklinkSnapshot[] {
    this.assertProject(projectId);
    return this.db.prepare(`SELECT * FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, rowid DESC`).all(projectId).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      capturedAt: String(row.captured_at),
      totalBacklinks: Number(row.total_backlinks),
      referringDomains: Number(row.referring_domains),
      sourceConfidence: String(row.source_confidence) as BacklinkSnapshot["sourceConfidence"]
    }));
  }

  private assertProject(projectId: string): void {
    if (!this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId)) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
  }

  private mapBacklink(row: Record<string, unknown>): Backlink {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      snapshotId: String(row.snapshot_id),
      sourceUrl: String(row.source_url),
      sourceDomain: String(row.source_domain),
      targetUrl: String(row.target_url),
      anchorText: String(row.anchor_text),
      linkType: String(row.link_type) as LinkType,
      firstSeenAt: String(row.first_seen_at),
      lastSeenAt: String(row.last_seen_at),
      sourceConfidence: String(row.source_confidence) as Backlink["sourceConfidence"]
    };
  }
}
