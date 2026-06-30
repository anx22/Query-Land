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
import { resolveSearchAnalyticsProvider } from "../search-performance/index.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

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
  syncSearchPerformance(projectId: string, siteId: string, options?: SearchPerformanceSyncOptions): Promise<SearchPerformanceSyncResult>;
  listSearchPerformance(projectId: string, siteId: string, options?: { limit?: number; offset?: number }): Promise<SearchPerformancePage>;
  searchPerformanceIntelligence(projectId: string, siteId: string): Promise<SearchPerformanceIntelligence>;
}

export function createSearchPerformanceStore(db: AsyncDatabase, audit: AuditLog): SearchPerformanceStore {
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
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  private async requireSite(projectId: string, siteId: string): Promise<{ base_url: string }> {
    const site = await this.db.prepare(`SELECT base_url FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId) as { base_url?: string } | undefined;
    if (!site || typeof site.base_url !== "string") {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
    return { base_url: site.base_url };
  }

  async syncSearchPerformance(projectId: string, siteId: string, options: SearchPerformanceSyncOptions = {}): Promise<SearchPerformanceSyncResult> {
    const site = await this.requireSite(projectId, siteId);
    const market = (options.market ?? DEFAULT_MARKET).trim() || DEFAULT_MARKET;
    const provider = await resolveSearchAnalyticsProvider(this.db, projectId, market);
    const rows = await provider.fetch({ baseUrl: site.base_url, market });
    const capturedAt = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      const insert = tx.prepare(`INSERT INTO search_performance_rows (id, project_id, site_id, query, page_url, clicks, impressions, ctr, position, market, captured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of rows) {
        await insert.run(`sp-${randomUUID()}`, projectId, siteId, row.query, row.pageUrl, row.clicks, row.impressions, row.ctr, row.position, market, capturedAt, provider.sourceConfidence);
      }
    });

    await this.audit("system", "search_performance.sync", "site", siteId, { projectId, market, rows: rows.length });
    return { inserted: rows.length, capturedAt, market };
  }

  private async latestCapturedAt(siteId: string): Promise<string | null> {
    const row = await this.db.prepare(`SELECT MAX(captured_at) AS captured_at FROM search_performance_rows WHERE site_id = ?`).get(siteId) as { captured_at?: string | null } | undefined;
    return row && row.captured_at ? String(row.captured_at) : null;
  }

  private async latestRows(siteId: string): Promise<SearchPerformanceRow[]> {
    const capturedAt = await this.latestCapturedAt(siteId);
    if (!capturedAt) return [];
    return (await this.db.prepare(`SELECT * FROM search_performance_rows WHERE site_id = ? AND captured_at = ? ORDER BY impressions DESC, id ASC`).all(siteId, capturedAt)).map((row) => this.mapRow(row));
  }

  async listSearchPerformance(projectId: string, siteId: string, options: { limit?: number; offset?: number } = {}): Promise<SearchPerformancePage> {
    await this.requireSite(projectId, siteId);
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);
    const capturedAt = await this.latestCapturedAt(siteId);
    if (!capturedAt) {
      return { data: [], limit, offset, total: 0, nextCursor: null };
    }
    const total = Number((await this.db.prepare(`SELECT COUNT(*) AS c FROM search_performance_rows WHERE site_id = ? AND captured_at = ?`).get(siteId, capturedAt) as { c: number }).c);
    const rows = await this.db.prepare(`SELECT * FROM search_performance_rows WHERE site_id = ? AND captured_at = ? ORDER BY impressions DESC, id ASC LIMIT ? OFFSET ?`).all(siteId, capturedAt, limit, offset);
    const data = rows.map((row) => this.mapRow(row));
    const nextOffset = offset + data.length;
    const nextCursor = nextOffset < total ? Buffer.from(`offset:${nextOffset}`, "utf8").toString("base64url") : null;
    return { data, limit, offset, total, nextCursor };
  }

  async searchPerformanceIntelligence(projectId: string, siteId: string): Promise<SearchPerformanceIntelligence> {
    await this.requireSite(projectId, siteId);
    const capturedAt = await this.latestCapturedAt(siteId);
    const rows = await this.latestRows(siteId);
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
