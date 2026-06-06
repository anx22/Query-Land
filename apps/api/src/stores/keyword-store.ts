import { randomUUID } from "node:crypto";
import { classifyFunnelStage, classifyIntent, isBrandKeyword, normalizeKeyword, type FunnelStage, type Keyword, type KeywordGroup, type KeywordIntent, type KeywordSource } from "@seo-tool/domain-model";
import type { SourceConfidence } from "@seo-tool/domain-model";
import type { AuditLog } from "./audit-log.js";
import { RequestError, sqliteConstraintError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

export interface KeywordInput {
  phrase: string;
  intent?: KeywordIntent;
  brand?: boolean;
  market?: string;
  targetUrl?: string | null;
  source?: KeywordSource;
  sourceConfidence?: SourceConfidence;
}

export interface AddKeywordsInput {
  groupId?: string | null;
  brandTerms?: string[];
  keywords: KeywordInput[];
}

export interface KeywordListFilters {
  groupId?: string;
  intent?: KeywordIntent;
  brand?: boolean;
  market?: string;
}

export interface KeywordPage {
  data: Keyword[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface KeywordStore {
  createKeywordGroup(projectId: string, input: { name: string; topic?: string }): KeywordGroup;
  listKeywordGroups(projectId: string): KeywordGroup[];
  addKeywords(projectId: string, input: AddKeywordsInput): { inserted: number; updated: number; keywords: Keyword[] };
  listKeywordsPage(projectId: string, options?: { limit?: number; offset?: number }, filters?: KeywordListFilters): KeywordPage;
  mapKeywordToUrl(projectId: string, keywordId: string, targetUrl: string | null): Keyword;
}

export function createKeywordStore(db: SQLiteDatabase, audit: AuditLog): KeywordStore {
  return new SQLiteKeywordStore(db, audit);
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

class SQLiteKeywordStore implements KeywordStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  private assertProject(projectId: string): void {
    if (!this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId)) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
  }

  createKeywordGroup(projectId: string, input: { name: string; topic?: string }): KeywordGroup {
    this.assertProject(projectId);
    if (!input.name || input.name.trim() === "") {
      throw new RequestError(400, "missing_field", "name is required");
    }
    const group: KeywordGroup = {
      id: `kwg-${randomUUID()}`,
      projectId,
      name: input.name.trim(),
      topic: input.topic?.trim() ?? "",
      createdAt: new Date().toISOString()
    };
    try {
      this.db.prepare(`INSERT INTO keyword_groups (id, project_id, name, topic, created_at) VALUES (?, ?, ?, ?, ?)`).run(group.id, group.projectId, group.name, group.topic, group.createdAt);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_keyword_group", "Keyword group name already exists for this project");
    }
    this.audit("system", "keyword_group.create", "keyword_group", group.id, { projectId, name: group.name });
    return group;
  }

  listKeywordGroups(projectId: string): KeywordGroup[] {
    return this.db.prepare(`SELECT * FROM keyword_groups WHERE project_id = ? ORDER BY created_at ASC`).all(projectId).map((row) => this.mapGroup(row));
  }

  addKeywords(projectId: string, input: AddKeywordsInput): { inserted: number; updated: number; keywords: Keyword[] } {
    this.assertProject(projectId);
    const groupId = input.groupId ?? null;
    if (groupId && !this.db.prepare(`SELECT 1 FROM keyword_groups WHERE id = ? AND project_id = ?`).get(groupId, projectId)) {
      throw new RequestError(404, "unknown_keyword_group", "Keyword group not found for project");
    }
    if (!Array.isArray(input.keywords) || input.keywords.length === 0) {
      throw new RequestError(400, "missing_field", "keywords must be a non-empty array");
    }
    const brandTerms = Array.isArray(input.brandTerms) ? input.brandTerms : [];
    const now = new Date().toISOString();

    let inserted = 0;
    let updated = 0;
    const keywords: Keyword[] = [];

    this.db.exec("BEGIN");
    try {
      const findStmt = this.db.prepare(`SELECT id, created_at FROM keywords WHERE project_id = ? AND normalized_phrase = ? AND market = ?`);
      const insertStmt = this.db.prepare(`INSERT INTO keywords (id, project_id, group_id, phrase, normalized_phrase, intent, brand, funnel_stage, market, target_url, source, source_confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const updateStmt = this.db.prepare(`UPDATE keywords SET group_id = ?, phrase = ?, intent = ?, brand = ?, funnel_stage = ?, target_url = ?, source = ?, source_confidence = ?, updated_at = ? WHERE id = ?`);

      for (const item of input.keywords) {
        if (typeof item.phrase !== "string" || item.phrase.trim() === "") {
          throw new RequestError(400, "invalid_keyword", "each keyword needs a non-empty phrase");
        }
        const normalized = normalizeKeyword(item.phrase);
        const market = (item.market ?? "DE").trim() || "DE";
        const intent: KeywordIntent = item.intent ?? classifyIntent(item.phrase);
        const funnelStage: FunnelStage = classifyFunnelStage(intent);
        const brand = typeof item.brand === "boolean" ? item.brand : isBrandKeyword(item.phrase, brandTerms);
        const source: KeywordSource = item.source ?? "manual";
        const sourceConfidence: SourceConfidence = item.sourceConfidence ?? (source === "manual" ? "A" : source === "gsc" ? "B" : "C");
        const targetUrl = item.targetUrl ?? null;

        const existing = findStmt.get(projectId, normalized, market) as { id: string; created_at: string } | undefined;
        let id: string;
        let createdAt: string;
        if (existing) {
          id = existing.id;
          createdAt = String(existing.created_at);
          updateStmt.run(groupId, item.phrase.trim(), intent, brand ? 1 : 0, funnelStage, targetUrl, source, sourceConfidence, now, id);
          updated += 1;
        } else {
          id = `kw-${randomUUID()}`;
          createdAt = now;
          insertStmt.run(id, projectId, groupId, item.phrase.trim(), normalized, intent, brand ? 1 : 0, funnelStage, market, targetUrl, source, sourceConfidence, now, now);
          inserted += 1;
        }
        keywords.push({ id, projectId, groupId, phrase: item.phrase.trim(), normalizedPhrase: normalized, intent, brand, funnelStage, market, targetUrl, source, sourceConfidence, createdAt, updatedAt: now });
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    this.audit("system", "keywords.add", "project", projectId, { inserted, updated });
    return { inserted, updated, keywords };
  }

  listKeywordsPage(projectId: string, options: { limit?: number; offset?: number } = {}, filters: KeywordListFilters = {}): KeywordPage {
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);
    const clauses = ["project_id = ?"];
    const args: unknown[] = [projectId];
    if (filters.groupId) {
      clauses.push("group_id = ?");
      args.push(filters.groupId);
    }
    if (filters.intent) {
      clauses.push("intent = ?");
      args.push(filters.intent);
    }
    if (typeof filters.brand === "boolean") {
      clauses.push("brand = ?");
      args.push(filters.brand ? 1 : 0);
    }
    if (filters.market) {
      clauses.push("market = ?");
      args.push(filters.market);
    }
    const where = clauses.join(" AND ");
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS c FROM keywords WHERE ${where}`).get(...args) as { c: number }).c);
    const rows = this.db.prepare(`SELECT * FROM keywords WHERE ${where} ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`).all(...args, limit, offset);
    const data = rows.map((row) => this.mapKeyword(row));
    const nextOffset = offset + data.length;
    const nextCursor = nextOffset < total ? Buffer.from(`offset:${nextOffset}`, "utf8").toString("base64url") : null;
    return { data, limit, offset, total, nextCursor };
  }

  mapKeywordToUrl(projectId: string, keywordId: string, targetUrl: string | null): Keyword {
    const row = this.db.prepare(`SELECT * FROM keywords WHERE id = ? AND project_id = ?`).get(keywordId, projectId);
    if (!row) {
      throw new RequestError(404, "unknown_keyword", "Keyword not found for project");
    }
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE keywords SET target_url = ?, updated_at = ? WHERE id = ?`).run(targetUrl, now, keywordId);
    this.audit("system", "keyword.map_url", "keyword", keywordId, { projectId, targetUrl });
    return this.mapKeyword(this.db.prepare(`SELECT * FROM keywords WHERE id = ?`).get(keywordId) as Record<string, unknown>);
  }

  private mapGroup(row: Record<string, unknown>): KeywordGroup {
    return { id: String(row.id), projectId: String(row.project_id), name: String(row.name), topic: String(row.topic), createdAt: String(row.created_at) };
  }

  private mapKeyword(row: Record<string, unknown>): Keyword {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      groupId: row.group_id === null || row.group_id === undefined ? null : String(row.group_id),
      phrase: String(row.phrase),
      normalizedPhrase: String(row.normalized_phrase),
      intent: String(row.intent) as KeywordIntent,
      brand: Number(row.brand) === 1,
      funnelStage: String(row.funnel_stage) as FunnelStage,
      market: String(row.market),
      targetUrl: row.target_url === null || row.target_url === undefined ? null : String(row.target_url),
      source: String(row.source) as KeywordSource,
      sourceConfidence: String(row.source_confidence) as SourceConfidence,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }
}
