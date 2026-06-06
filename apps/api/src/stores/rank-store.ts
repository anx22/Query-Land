import { randomUUID } from "node:crypto";
import { computeVisibilityScore, type RankSnapshot, type SerpDevice, type SerpDiff, type SerpResult, type SerpSnapshot, type VisibilityScore } from "@seo-tool/domain-model";
import { getSerpProvider } from "../serp/index.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

const DEFAULT_MARKET = "DE";

export interface RecordRankOptions {
  market?: string;
  device?: SerpDevice;
}

export interface RankSnapshotResult {
  serpSnapshot: SerpSnapshot;
  rankSnapshot: RankSnapshot;
}

export interface RankStore {
  recordRankSnapshot(projectId: string, keywordId: string, options?: RecordRankOptions): RankSnapshotResult;
  listRankSnapshots(projectId: string, keywordId: string): RankSnapshot[];
  listSerpSnapshots(projectId: string, keywordId: string): SerpSnapshot[];
  serpDiff(projectId: string, keywordId: string): SerpDiff;
  computeVisibility(projectId: string, market?: string): VisibilityScore;
  listVisibilityScores(projectId: string, market?: string): VisibilityScore[];
}

export function createRankStore(db: SQLiteDatabase, audit: AuditLog): RankStore {
  return new SQLiteRankStore(db, audit);
}

function hostOf(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).host || null;
  } catch {
    return null;
  }
}

class SQLiteRankStore implements RankStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  recordRankSnapshot(projectId: string, keywordId: string, options: RecordRankOptions = {}): RankSnapshotResult {
    const keyword = this.db.prepare(`SELECT phrase, market FROM keywords WHERE id = ? AND project_id = ?`).get(keywordId, projectId) as { phrase: string; market: string } | undefined;
    if (!keyword) {
      throw new RequestError(404, "unknown_keyword", "Keyword not found for project");
    }
    const market = options.market ?? keyword.market ?? DEFAULT_MARKET;
    const device: SerpDevice = options.device ?? "desktop";
    const site = this.db.prepare(`SELECT base_url FROM sites WHERE project_id = ? ORDER BY created_at ASC LIMIT 1`).get(projectId) as { base_url?: string } | undefined;
    const ownDomain = hostOf(site?.base_url);

    const provider = getSerpProvider();
    const fetched = provider.fetch({ phrase: keyword.phrase, market, device, ownDomain });
    const now = new Date().toISOString();
    const serpSnapshotId = `serp-${randomUUID()}`;
    const rankSnapshotId = `rank-${randomUUID()}`;
    const ownResult = fetched.ownPosition === null ? null : fetched.results.find((result) => result.position === fetched.ownPosition) ?? null;

    this.db.exec("BEGIN");
    try {
      this.db.prepare(`INSERT INTO serp_snapshots (id, project_id, keyword_id, market, device, captured_at, results, serp_features, own_position, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        serpSnapshotId, projectId, keywordId, market, device, now, JSON.stringify(fetched.results), JSON.stringify(fetched.serpFeatures), fetched.ownPosition, provider.sourceConfidence
      );
      this.db.prepare(`INSERT INTO rank_snapshots (id, project_id, keyword_id, serp_snapshot_id, market, device, position, url, captured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        rankSnapshotId, projectId, keywordId, serpSnapshotId, market, device, fetched.ownPosition, ownResult?.url ?? null, now, provider.sourceConfidence
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    this.audit("system", "rank.snapshot", "keyword", keywordId, { projectId, market, device, ownPosition: fetched.ownPosition });
    return {
      serpSnapshot: { id: serpSnapshotId, projectId, keywordId, market, device, capturedAt: now, results: fetched.results, serpFeatures: fetched.serpFeatures, ownPosition: fetched.ownPosition, sourceConfidence: provider.sourceConfidence },
      rankSnapshot: { id: rankSnapshotId, projectId, keywordId, serpSnapshotId, market, device, position: fetched.ownPosition, url: ownResult?.url ?? null, capturedAt: now, sourceConfidence: provider.sourceConfidence }
    };
  }

  listRankSnapshots(projectId: string, keywordId: string): RankSnapshot[] {
    this.assertKeyword(projectId, keywordId);
    return this.db.prepare(`SELECT * FROM rank_snapshots WHERE project_id = ? AND keyword_id = ? ORDER BY captured_at ASC, id ASC`).all(projectId, keywordId).map((row) => this.mapRank(row));
  }

  listSerpSnapshots(projectId: string, keywordId: string): SerpSnapshot[] {
    this.assertKeyword(projectId, keywordId);
    return this.db.prepare(`SELECT * FROM serp_snapshots WHERE project_id = ? AND keyword_id = ? ORDER BY captured_at ASC, id ASC`).all(projectId, keywordId).map((row) => this.mapSerp(row));
  }

  serpDiff(projectId: string, keywordId: string): SerpDiff {
    this.assertKeyword(projectId, keywordId);
    const snapshots = this.db.prepare(`SELECT * FROM serp_snapshots WHERE project_id = ? AND keyword_id = ? ORDER BY captured_at DESC, id DESC LIMIT 2`).all(projectId, keywordId).map((row) => this.mapSerp(row));
    if (snapshots.length === 0) {
      throw new RequestError(404, "no_serp_snapshots", "No SERP snapshots recorded for this keyword");
    }
    const after = snapshots[0];
    const before = snapshots[1] ?? null;
    const afterDomains = new Set(after.results.map((result) => result.domain));
    const beforeDomains = new Set(before ? before.results.map((result) => result.domain) : []);
    const afterFeatures = new Set(after.serpFeatures);
    const beforeFeatures = new Set(before ? before.serpFeatures : []);
    const ownPositionDelta = before && before.ownPosition !== null && after.ownPosition !== null ? before.ownPosition - after.ownPosition : null;

    return {
      keywordId,
      ownPositionBefore: before ? before.ownPosition : null,
      ownPositionAfter: after.ownPosition,
      ownPositionDelta,
      enteredDomains: [...afterDomains].filter((domain) => !beforeDomains.has(domain)),
      leftDomains: [...beforeDomains].filter((domain) => !afterDomains.has(domain)),
      gainedFeatures: [...afterFeatures].filter((feature) => !beforeFeatures.has(feature)),
      lostFeatures: [...beforeFeatures].filter((feature) => !afterFeatures.has(feature))
    };
  }

  computeVisibility(projectId: string, market: string = DEFAULT_MARKET): VisibilityScore {
    if (!this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId)) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    // Neueste Rank-Position je Keyword im Markt (das getrackte Set).
    const rows = this.db.prepare(`
      SELECT r.position AS position FROM rank_snapshots r
      WHERE r.project_id = ? AND r.market = ? AND r.id = (
        SELECT x.id FROM rank_snapshots x WHERE x.keyword_id = r.keyword_id AND x.market = r.market ORDER BY x.captured_at DESC, x.id DESC LIMIT 1
      )
    `).all(projectId, market) as Array<{ position: number | null }>;
    const result = computeVisibilityScore({ positions: rows.map((row) => (row.position === null ? null : Number(row.position))) });

    const now = new Date().toISOString();
    const id = `vis-${randomUUID()}`;
    this.db.prepare(`INSERT INTO visibility_scores (id, project_id, market, score, tracked_keywords, average_position, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, projectId, market, result.score, result.trackedKeywords, result.averagePosition, now
    );
    this.audit("system", "visibility.compute", "project", projectId, { market, score: result.score, trackedKeywords: result.trackedKeywords });
    return { id, projectId, market, score: result.score, trackedKeywords: result.trackedKeywords, averagePosition: result.averagePosition, computedAt: now };
  }

  listVisibilityScores(projectId: string, market?: string): VisibilityScore[] {
    const clauses = ["project_id = ?"];
    const args: unknown[] = [projectId];
    if (market) {
      clauses.push("market = ?");
      args.push(market);
    }
    return this.db.prepare(`SELECT * FROM visibility_scores WHERE ${clauses.join(" AND ")} ORDER BY computed_at DESC, id DESC`).all(...args).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      market: String(row.market),
      score: Number(row.score),
      trackedKeywords: Number(row.tracked_keywords),
      averagePosition: row.average_position === null ? null : Number(row.average_position),
      computedAt: String(row.computed_at)
    }));
  }

  private assertKeyword(projectId: string, keywordId: string): void {
    if (!this.db.prepare(`SELECT 1 FROM keywords WHERE id = ? AND project_id = ?`).get(keywordId, projectId)) {
      throw new RequestError(404, "unknown_keyword", "Keyword not found for project");
    }
  }

  private mapRank(row: Record<string, unknown>): RankSnapshot {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      keywordId: String(row.keyword_id),
      serpSnapshotId: row.serp_snapshot_id === null || row.serp_snapshot_id === undefined ? null : String(row.serp_snapshot_id),
      market: String(row.market),
      device: String(row.device) as SerpDevice,
      position: row.position === null || row.position === undefined ? null : Number(row.position),
      url: row.url === null || row.url === undefined ? null : String(row.url),
      capturedAt: String(row.captured_at),
      sourceConfidence: String(row.source_confidence) as RankSnapshot["sourceConfidence"]
    };
  }

  private mapSerp(row: Record<string, unknown>): SerpSnapshot {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      keywordId: String(row.keyword_id),
      market: String(row.market),
      device: String(row.device) as SerpDevice,
      capturedAt: String(row.captured_at),
      results: JSON.parse(String(row.results)) as SerpResult[],
      serpFeatures: JSON.parse(String(row.serp_features)) as string[],
      ownPosition: row.own_position === null || row.own_position === undefined ? null : Number(row.own_position),
      sourceConfidence: String(row.source_confidence) as SerpSnapshot["sourceConfidence"]
    };
  }
}
