import { randomUUID } from "node:crypto";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export interface InternalLinkEdgeInput {
  fromUrl: string;
  toUrl: string;
  anchor?: string | null;
  rel?: string | null;
}

export interface InternalLinkEdge {
  id: string;
  projectId: string;
  siteId: string;
  fromUrl: string;
  toUrl: string;
  anchor: string | null;
  rel: string | null;
  discoveredAt: string;
}

export interface OrphanUrl {
  url: string;
  normalizedUrl: string;
  depth: number;
}

export interface LinkGraphPage<T> {
  data: T[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface LinkGraphStore {
  recordInternalLinks(projectId: string, siteId: string, edges: InternalLinkEdgeInput[]): Promise<{ inserted: number; updated: number }>;
  listInternalLinks(projectId: string, siteId: string, direction: "in" | "out", url: string, options: { limit?: number; offset?: number }): Promise<LinkGraphPage<InternalLinkEdge>>;
  listOrphanUrls(projectId: string, siteId: string, options: { limit?: number; offset?: number }): Promise<LinkGraphPage<OrphanUrl>>;
}

export function createLinkGraphStore(db: AsyncDatabase, audit: AuditLog): LinkGraphStore {
  return new SQLiteLinkGraphStore(db, audit);
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function normalizeOffset(offset?: number): number {
  if (!offset || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

function nextCursor(offset: number, count: number, total: number): string | null {
  const nextOffset = offset + count;
  return nextOffset < total ? Buffer.from(`offset:${nextOffset}`, "utf8").toString("base64url") : null;
}

class SQLiteLinkGraphStore implements LinkGraphStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  private async assertSiteScope(projectId: string, siteId: string): Promise<void> {
    const row = await this.db.prepare(`SELECT 1 FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!row) {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
  }

  async recordInternalLinks(projectId: string, siteId: string, edges: InternalLinkEdgeInput[]): Promise<{ inserted: number; updated: number }> {
    await this.assertSiteScope(projectId, siteId);
    if (!Array.isArray(edges) || edges.length === 0) {
      throw new RequestError(400, "missing_field", "edges is required and must be a non-empty array");
    }

    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;

    const result = await this.db.transaction(async (tx) => {
      const existing = tx.prepare(`SELECT id FROM internal_link_edges WHERE site_id = ? AND from_url = ? AND to_url = ?`);
      const insert = tx.prepare(`INSERT INTO internal_link_edges (id, project_id, site_id, from_url, to_url, anchor, rel, discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      const update = tx.prepare(`UPDATE internal_link_edges SET anchor = ?, rel = ?, discovered_at = ? WHERE id = ?`);

      for (const edge of edges) {
        if (typeof edge.fromUrl !== "string" || typeof edge.toUrl !== "string" || !edge.fromUrl || !edge.toUrl) {
          throw new RequestError(400, "invalid_edge", "each edge needs non-empty fromUrl and toUrl");
        }
        const anchor = edge.anchor ?? null;
        const rel = edge.rel ?? null;
        const found = await existing.get(siteId, edge.fromUrl, edge.toUrl) as { id: string } | undefined;
        if (found) {
          await update.run(anchor, rel, now, found.id);
          updated += 1;
        } else {
          await insert.run(`lnk-${randomUUID()}`, projectId, siteId, edge.fromUrl, edge.toUrl, anchor, rel, now);
          inserted += 1;
        }
      }
      return { inserted, updated };
    });

    await this.audit("system", "internal_links.record", "site", siteId, { projectId, inserted, updated });
    return result;
  }

  async listInternalLinks(projectId: string, siteId: string, direction: "in" | "out", url: string, options: { limit?: number; offset?: number }): Promise<LinkGraphPage<InternalLinkEdge>> {
    await this.assertSiteScope(projectId, siteId);
    if (!url) {
      throw new RequestError(400, "missing_field", "url query parameter is required");
    }
    const column = direction === "in" ? "to_url" : "from_url";
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);

    const total = Number((await this.db.prepare(`SELECT COUNT(*) AS c FROM internal_link_edges WHERE site_id = ? AND ${column} = ?`).get(siteId, url) as { c: number }).c);
    const rows = await this.db.prepare(`SELECT * FROM internal_link_edges WHERE site_id = ? AND ${column} = ? ORDER BY discovered_at ASC, id ASC LIMIT ? OFFSET ?`).all(siteId, url, limit, offset);
    const data = rows.map((row) => this.mapEdge(row));
    return { data, limit, offset, total, nextCursor: nextCursor(offset, data.length, total) };
  }

  async listOrphanUrls(projectId: string, siteId: string, options: { limit?: number; offset?: number }): Promise<LinkGraphPage<OrphanUrl>> {
    await this.assertSiteScope(projectId, siteId);
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);

    const where = `FROM discovered_urls du WHERE du.site_id = ? AND NOT EXISTS (SELECT 1 FROM internal_link_edges e WHERE e.site_id = du.site_id AND e.to_url = du.normalized_url)`;
    const total = Number((await this.db.prepare(`SELECT COUNT(*) AS c ${where}`).get(siteId) as { c: number }).c);
    const rows = await this.db.prepare(`SELECT du.url AS url, du.normalized_url AS normalized_url, du.depth AS depth ${where} ORDER BY du.depth ASC, du.url ASC LIMIT ? OFFSET ?`).all(siteId, limit, offset);
    const data = rows.map((row) => ({ url: String(row.url), normalizedUrl: String(row.normalized_url), depth: Number(row.depth) }));
    return { data, limit, offset, total, nextCursor: nextCursor(offset, data.length, total) };
  }

  private mapEdge(row: Record<string, unknown>): InternalLinkEdge {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      siteId: String(row.site_id),
      fromUrl: String(row.from_url),
      toUrl: String(row.to_url),
      anchor: row.anchor === null ? null : String(row.anchor),
      rel: row.rel === null ? null : String(row.rel),
      discoveredAt: String(row.discovered_at)
    };
  }
}
