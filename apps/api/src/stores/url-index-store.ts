import { randomUUID } from "node:crypto";
import { resolveGscAdapterContext } from "../oauth/gsc-credentials.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

// The GSC URL Inspection API quota is 2000 inspections/day/property. Inspect a bounded slice per run
// (shallowest URLs first) and report when capped — never silently inspect "everything".
const DEFAULT_MAX_URLS = 200;
const HARD_MAX_URLS = 2000;

export interface UrlInspectionSyncResult {
  inspected: number;
  indexed: number;
  requested: number;
  capped: boolean;
}

export interface IndexStatusSummary {
  indexed: number;
  total: number;
  inspectedAt: string | null;
}

export interface UrlIndexStore {
  /** Inspect a bounded set of the site's discovered URLs against GSC and persist their index status. */
  syncUrlInspection(projectId: string, siteId: string, options?: { maxUrls?: number }): Promise<UrlInspectionSyncResult>;
  /** Aggregate index status for the Technical Audit "indexed" funnel stage. */
  indexStatusSummary(projectId: string, siteId: string): Promise<IndexStatusSummary>;
}

export function createUrlIndexStore(db: AsyncDatabase, audit: AuditLog): UrlIndexStore {
  return new SQLiteUrlIndexStore(db, audit);
}

class SQLiteUrlIndexStore implements UrlIndexStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  private async requireSite(projectId: string, siteId: string): Promise<void> {
    if (!await this.db.prepare(`SELECT 1 FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId)) {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
  }

  async syncUrlInspection(projectId: string, siteId: string, options: { maxUrls?: number } = {}): Promise<UrlInspectionSyncResult> {
    await this.requireSite(projectId, siteId);
    const maxUrls = Math.max(1, Math.min(HARD_MAX_URLS, Math.trunc(options.maxUrls ?? DEFAULT_MAX_URLS)));

    // No connected/configured GSC → honest empty state, never a crash.
    const ctx = await resolveGscAdapterContext(this.db, projectId);
    if (!ctx) return { inspected: 0, indexed: 0, requested: 0, capped: false };

    const urlRows = await this.db.prepare(
      `SELECT url FROM discovered_urls WHERE project_id = ? AND site_id = ? ORDER BY depth ASC, discovered_at ASC LIMIT ?`
    ).all(projectId, siteId, maxUrls + 1) as Array<{ url: string }>;
    const capped = urlRows.length > maxUrls;
    const urls = urlRows.slice(0, maxUrls).map((row) => String(row.url));

    let inspected = 0;
    let indexed = 0;
    const now = new Date().toISOString();
    for (const url of urls) {
      try {
        const result = await ctx.client.inspectUrl(ctx.creds.accessToken, ctx.creds.property, url);
        await this.db.prepare(
          `INSERT INTO url_index_status (id, project_id, site_id, url, verdict, coverage_state, indexed, last_crawl_time, inspected_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (site_id, url) DO UPDATE SET
             verdict = EXCLUDED.verdict, coverage_state = EXCLUDED.coverage_state, indexed = EXCLUDED.indexed,
             last_crawl_time = EXCLUDED.last_crawl_time, inspected_at = EXCLUDED.inspected_at`
        ).run(`uix-${randomUUID()}`, projectId, siteId, url, result.verdict, result.coverageState, result.indexed ? 1 : 0, result.lastCrawlTime, now);
        inspected += 1;
        if (result.indexed) indexed += 1;
      } catch {
        // A single URL failing (quota hit, transient) must not abort the round.
      }
    }

    await this.audit("system", "url_inspection.sync", "site", siteId, { projectId, inspected, indexed, capped });
    return { inspected, indexed, requested: urls.length, capped };
  }

  async indexStatusSummary(projectId: string, siteId: string): Promise<IndexStatusSummary> {
    await this.requireSite(projectId, siteId);
    const row = await this.db.prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(indexed), 0) AS indexed, MAX(inspected_at) AS inspected_at
         FROM url_index_status WHERE project_id = ? AND site_id = ?`
    ).get(projectId, siteId) as { total: number; indexed: number; inspected_at: string | null };
    return {
      indexed: Number(row.indexed),
      total: Number(row.total),
      inspectedAt: row.inspected_at ? String(row.inspected_at) : null
    };
  }
}
