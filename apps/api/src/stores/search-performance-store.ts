import { randomUUID } from "node:crypto";
import {
  analyzeCannibalization,
  analyzeCtrGap,
  analyzeStrikingDistance,
  type CannibalizationItem,
  type CtrGapItem,
  type SearchPerformanceMetricRow,
  type SearchPerformanceRow,
  type StrikingDistanceItem
} from "@seo-tool/domain-model";
import { getSearchAnalyticsProvider } from "../search-performance/index.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

const DEFAULT_MARKET = "DE";
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export interface SearchPerformanceSyncOptions {
  market?: string;
}

export interface SearchPerformanceSyncResult {
  inserted: number;
  capturedAt: string;
  market: string;
}

export interface SearchPerformancePage {
  data: SearchPerformanceRow[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface SearchPerformanceIntelligence {
  capturedAt: string | null;
  strikingDistance: StrikingDistanceItem[];
  ctrGaps: CtrGapItem[];
  cannibalization: CannibalizationItem[];
  summary: {
    rows: number;
    strikingDistance: number;
    ctrGaps: number;
    cannibalization: number;
  };
}

export interface SearchPerformanceStore {
  syncSearchPerformance(projectId: string, siteId: string, options?: SearchPerformanceSyncOptions): SearchPerformanceSyncResult;
  listSearchPerformance(projectId: string, siteId: string, options?: { limit?: number; offset?: number }): SearchPerformancePage;
  searchPerformanceIntelligence(projectId: string, siteId: string): SearchPerformanceIntelligence;
}

export function createSearchPerformanceStore(db: SQLiteDatabase, audit: AuditLog): SearchPerformanceStore {
  return new SQLiteSearchPerformanceStore(db, audit);
}

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function normalizeOffset(offset?: number): number {
  if (!offset || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

class SQLiteSearchPerformanceStore implements SearchPerformanceStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  private requireSite(projectId: string, siteId: string): { base_url: string } {
    const site = this.db.prepare(`SELECT base_url FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId) as { base_url?: string } | undefined;
    if (!site || typeof site.base_url !== "string") {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
    return { base_url: site.base_url };
  }

  syncSearchPerformance(projectId: string, siteId: string, options: SearchPerformanceSyncOptions = {}): SearchPerformanceSyncResult {
    const site = this.requireSite(projectId, siteId);
    const market = (options.market ?? DEFAULT_MARKET).trim() || DEFAULT_MARKET;
    const provider = getSearchAnalyticsProvider();
    const rows = provider.fetch({ baseUrl: site.base_url, market });
    const capturedAt = new Date().toISOString();

    this.db.exec("BEGIN");
    try {
      const insert = this.db.prepare(`INSERT INTO search_performance_rows (id, project_id, site_id, query, page_url, clicks, impressions, ctr, position, market, captured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of rows) {
        insert.run(`sp-${randomUUID()}`, projectId, siteId, row.query, row.pageUrl, row.clicks, row.impressions, row.ctr, row.position, market, capturedAt, provider.sourceConfidence);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    this.audit("system", "search_performance.sync", "site", siteId, { projectId, market, rows: rows.length });
    return { inserted: rows.length, capturedAt, market };
  }

  private latestCapturedAt(siteId: string): string | null {
    const row = this.db.prepare(`SELECT MAX(captured_at) AS captured_at FROM search_performance_rows WHERE site_id = ?`).get(siteId) as { captured_at?: string | null } | undefined;
    return row && row.captured_at ? String(row.captured_at) : null;
  }

  private latestRows(siteId: string): SearchPerformanceRow[] {
    const capturedAt = this.latestCapturedAt(siteId);
    if (!capturedAt) return [];
    return this.db.prepare(`SELECT * FROM search_performance_rows WHERE site_id = ? AND captured_at = ? ORDER BY impressions DESC, id ASC`).all(siteId, capturedAt).map((row) => this.mapRow(row));
  }

  listSearchPerformance(projectId: string, siteId: string, options: { limit?: number; offset?: number } = {}): SearchPerformancePage {
    this.requireSite(projectId, siteId);
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);
    const capturedAt = this.latestCapturedAt(siteId);
    if (!capturedAt) {
      return { data: [], limit, offset, total: 0, nextCursor: null };
    }
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS c FROM search_performance_rows WHERE site_id = ? AND captured_at = ?`).get(siteId, capturedAt) as { c: number }).c);
    const rows = this.db.prepare(`SELECT * FROM search_performance_rows WHERE site_id = ? AND captured_at = ? ORDER BY impressions DESC, id ASC LIMIT ? OFFSET ?`).all(siteId, capturedAt, limit, offset);
    const data = rows.map((row) => this.mapRow(row));
    const nextOffset = offset + data.length;
    const nextCursor = nextOffset < total ? Buffer.from(`offset:${nextOffset}`, "utf8").toString("base64url") : null;
    return { data, limit, offset, total, nextCursor };
  }

  searchPerformanceIntelligence(projectId: string, siteId: string): SearchPerformanceIntelligence {
    this.requireSite(projectId, siteId);
    const capturedAt = this.latestCapturedAt(siteId);
    const rows = this.latestRows(siteId);
    const metricRows: SearchPerformanceMetricRow[] = rows.map((row) => ({ query: row.query, pageUrl: row.pageUrl, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }));
    const strikingDistance = analyzeStrikingDistance(metricRows);
    const ctrGaps = analyzeCtrGap(metricRows);
    const cannibalization = analyzeCannibalization(metricRows);
    return {
      capturedAt,
      strikingDistance,
      ctrGaps,
      cannibalization,
      summary: { rows: rows.length, strikingDistance: strikingDistance.length, ctrGaps: ctrGaps.length, cannibalization: cannibalization.length }
    };
  }

  private mapRow(row: Record<string, unknown>): SearchPerformanceRow {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      siteId: String(row.site_id),
      query: String(row.query),
      pageUrl: String(row.page_url),
      clicks: Number(row.clicks),
      impressions: Number(row.impressions),
      ctr: Number(row.ctr),
      position: Number(row.position),
      market: String(row.market),
      capturedAt: String(row.captured_at),
      sourceConfidence: String(row.source_confidence) as SearchPerformanceRow["sourceConfidence"]
    };
  }
}
