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
import type { AsyncDatabase } from "../db/index.js";

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
  importBacklinks(projectId: string): Promise<BacklinkImportResult>;
  listBacklinks(projectId: string, options?: { limit?: number; offset?: number }): Promise<BacklinkPage>;
  listReferringDomains(projectId: string): Promise<ReferringDomain[]>;
  backlinkDiff(projectId: string): Promise<BacklinkDiff>;
  authoritySummary(projectId: string): Promise<AuthoritySummary>;
  listBacklinkSnapshots(projectId: string): Promise<BacklinkSnapshot[]>;
}

export function createBacklinkStore(db: AsyncDatabase, audit: AuditLog): BacklinkStore {
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
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  private async requireProjectSite(projectId: string): Promise<{ baseUrl: string }> {
    if (!(await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId))) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    const site = await this.db.prepare(`SELECT base_url FROM sites WHERE project_id = ? ORDER BY created_at ASC LIMIT 1`).get(projectId) as { base_url?: string } | undefined;
    if (!site || typeof site.base_url !== "string") {
      throw new RequestError(400, "no_site", "Add a site before importing backlinks");
    }
    return { baseUrl: site.base_url };
  }

  async importBacklinks(projectId: string): Promise<BacklinkImportResult> {
    const { baseUrl } = await this.requireProjectSite(projectId);
    const round = Number((await this.db.prepare(`SELECT COUNT(*) AS c FROM backlink_snapshots WHERE project_id = ?`).get(projectId) as { c: number }).c);
    const provider = getBacklinkProvider();
    const rows = await provider.fetch({ baseUrl, round });
    const capturedAt = new Date().toISOString();
    const snapshotId = `blsnap-${randomUUID()}`;
    const referringDomains = new Set(rows.map((row) => row.sourceDomain)).size;

    await this.db.transaction(async (tx) => {
      await tx.prepare(`INSERT INTO backlink_snapshots (id, project_id, captured_at, total_backlinks, referring_domains, source_confidence) VALUES (?, ?, ?, ?, ?, ?)`).run(
        snapshotId, projectId, capturedAt, rows.length, referringDomains, provider.sourceConfidence
      );
      const insert = tx.prepare(`INSERT INTO backlinks (id, project_id, snapshot_id, source_url, source_domain, target_url, anchor_text, link_type, first_seen_at, last_seen_at, source_confidence, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of rows) {
        await insert.run(`bl-${randomUUID()}`, projectId, snapshotId, row.sourceUrl, row.sourceDomain, row.targetUrl, row.anchorText, row.linkType, capturedAt, capturedAt, provider.sourceConfidence, capturedAt);
      }
    });

    await this.audit("system", "backlinks.import", "project", projectId, { snapshotId, totalBacklinks: rows.length, referringDomains });
    return { snapshotId, totalBacklinks: rows.length, referringDomains, capturedAt };
  }

  private async latestSnapshotId(projectId: string): Promise<string | null> {
    const row = await this.db.prepare(`SELECT id FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, seq DESC LIMIT 1`).get(projectId) as { id?: string } | undefined;
    return row && row.id ? String(row.id) : null;
  }

  private async snapshotBacklinks(snapshotId: string): Promise<Backlink[]> {
    return (await this.db.prepare(`SELECT * FROM backlinks WHERE snapshot_id = ? ORDER BY source_domain ASC, source_url ASC`).all(snapshotId)).map((row) => this.mapBacklink(row));
  }

  async listBacklinks(projectId: string, options: { limit?: number; offset?: number } = {}): Promise<BacklinkPage> {
    await this.assertProject(projectId);
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);
    const snapshotId = await this.latestSnapshotId(projectId);
    if (!snapshotId) {
      return { data: [], limit, offset, total: 0, nextCursor: null };
    }
    const total = Number((await this.db.prepare(`SELECT COUNT(*) AS c FROM backlinks WHERE snapshot_id = ?`).get(snapshotId) as { c: number }).c);
    const rows = await this.db.prepare(`SELECT * FROM backlinks WHERE snapshot_id = ? ORDER BY source_domain ASC, source_url ASC LIMIT ? OFFSET ?`).all(snapshotId, limit, offset);
    const data = rows.map((row) => this.mapBacklink(row));
    const nextOffset = offset + data.length;
    const nextCursor = nextOffset < total ? Buffer.from(`offset:${nextOffset}`, "utf8").toString("base64url") : null;
    return { data, limit, offset, total, nextCursor };
  }

  async listReferringDomains(projectId: string): Promise<ReferringDomain[]> {
    await this.assertProject(projectId);
    const snapshotId = await this.latestSnapshotId(projectId);
    if (!snapshotId) return [];
    return aggregateReferringDomains(await this.snapshotBacklinks(snapshotId));
  }

  async backlinkDiff(projectId: string): Promise<BacklinkDiff> {
    await this.assertProject(projectId);
    const snapshots = await this.db.prepare(`SELECT id FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, seq DESC LIMIT 2`).all(projectId) as Array<{ id: string }>;
    // Ein New/Lost-Diff braucht eine Vorgänger-Charge; mit < 2 Snapshots gibt es keinen
    // sinnvollen Vergleich (sonst wären alle Links irreführend "neu").
    if (snapshots.length < 2) {
      throw new RequestError(404, "no_snapshots", "Need at least two backlink snapshots to diff (import again after the first import)");
    }
    const after = await this.snapshotBacklinks(String(snapshots[0].id));
    const before = await this.snapshotBacklinks(String(snapshots[1].id));
    return diffBacklinks(before, after);
  }

  async authoritySummary(projectId: string): Promise<AuthoritySummary> {
    await this.assertProject(projectId);
    const snapshotId = await this.latestSnapshotId(projectId);
    if (!snapshotId) return summarizeAuthority([]);
    return summarizeAuthority(await this.snapshotBacklinks(snapshotId));
  }

  async listBacklinkSnapshots(projectId: string): Promise<BacklinkSnapshot[]> {
    await this.assertProject(projectId);
    return (await this.db.prepare(`SELECT * FROM backlink_snapshots WHERE project_id = ? ORDER BY captured_at DESC, seq DESC`).all(projectId)).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      capturedAt: String(row.captured_at),
      totalBacklinks: Number(row.total_backlinks),
      referringDomains: Number(row.referring_domains),
      sourceConfidence: String(row.source_confidence) as BacklinkSnapshot["sourceConfidence"]
    }));
  }

  private async assertProject(projectId: string): Promise<void> {
    if (!(await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId))) {
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
