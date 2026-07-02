import { randomUUID } from "node:crypto";
import { calculateHealthScore, type AuditIssueHistoryEntry, type AuditIssueRecord, type AuditIssueSeverity, type CrawlFrontierEntry, type CrawlHealthScore, type CrawlPageSignal, type CrawlRun, type CrawlRunStatus, type DiscoveredUrl, type FetchStatusClass, type IndexabilityRecord, type UrlFetchRecord } from "@seo-tool/domain-model";
import { countIssueSeverities, emptyCrawlRunSummary, mapAuditIssueHistoryEntry, mapAuditIssueRecord, mapCrawlHealthScore, mapCrawlRun, mapDiscoveredUrl, mapIndexabilityRecord, mapUrlFetchRecord } from "../row-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export interface RecordAuditIssuesScope {
  checkedDiscoveredUrlIds: string[];
}

export interface ListPageOptions {
  limit?: number;
  offset?: number;
}

export interface ListPage<T> {
  data: T[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface CrawlRunListFilters {
  status?: CrawlRunStatus;
}

export interface AuditIssueListFilters {
  status?: "open" | "resolved" | "all";
  severity?: AuditIssueSeverity;
  rule?: AuditIssueRecord["rule"];
}

export interface DiscoveredUrlListFilters {
  status?: FetchStatusClass;
  source?: DiscoveredUrl["source"];
  /** Case-insensitive substring match on the URL. */
  q?: string;
}

export interface UrlExplorerRow {
  discoveredUrl: DiscoveredUrl;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
}

export interface CrawlStore {
  listCrawlRuns(projectId: string, siteId: string): Promise<CrawlRun[]>;
  listCrawlRunsPage(projectId: string, siteId: string, options?: ListPageOptions, filters?: CrawlRunListFilters): Promise<ListPage<CrawlRun>>;
  getCrawlRun(projectId: string, siteId: string, runId: string): Promise<CrawlRun | null>;
  createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): Promise<CrawlRun>;
  completeCrawlRun(projectId: string, siteId: string, runId: string, status: Extract<CrawlRun["status"], "succeeded" | "failed">, errorMessage?: string): Promise<CrawlRun>;
  listHealthScores(projectId: string, siteId: string): Promise<CrawlHealthScore[]>;
  computeHealthScore(projectId: string, siteId: string): Promise<CrawlHealthScore>;
  listAuditIssues(projectId: string, siteId: string): Promise<AuditIssueRecord[]>;
  listAuditIssuesPage(projectId: string, siteId: string, options?: ListPageOptions, filters?: AuditIssueListFilters): Promise<ListPage<AuditIssueRecord>>;
  /** Project-wide top-N open audit issues, severity-ranked in SQL (critical→low). One query across all sites. */
  listTopOpenAuditIssuesByProject(projectId: string, limit: number): Promise<AuditIssueRecord[]>;
  recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[], scope: RecordAuditIssuesScope): Promise<{ issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number }>;
  resolveAuditIssue(projectId: string, siteId: string, issueId: string, actor?: string): Promise<AuditIssueRecord>;
  dismissAuditIssue(projectId: string, siteId: string, issueId: string, reason?: string | null, actor?: string): Promise<AuditIssueRecord>;
  reopenAuditIssue(projectId: string, siteId: string, issueId: string, actor?: string): Promise<AuditIssueRecord>;
  listAuditIssueHistory(projectId: string, siteId: string, issueId: string): Promise<AuditIssueHistoryEntry[]>;
  listDiscoveredUrls(projectId: string, siteId?: string): Promise<DiscoveredUrl[]>;
  /** Resolve one discovered URL in a project by url OR normalized_url (optionally site-scoped), in a single indexed query. */
  findDiscoveredUrlInProject(projectId: string, url: string, siteId?: string): Promise<DiscoveredUrl | null>;
  listDiscoveredUrlsPage(projectId: string, siteId: string, options?: ListPageOptions, filters?: DiscoveredUrlListFilters): Promise<ListPage<DiscoveredUrl>>;
  listUrlExplorerRows(projectId: string, siteId: string, options?: ListPageOptions, filters?: DiscoveredUrlListFilters): Promise<ListPage<UrlExplorerRow>>;
  recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): Promise<{ urls: DiscoveredUrl[]; inserted: number; updated: number }>;
  listFetchResults(projectId: string, siteId: string, discoveredUrlId: string): Promise<UrlFetchRecord[]>;
  recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): Promise<UrlFetchRecord>;
  listIndexabilityAssessments(projectId: string, siteId: string, discoveredUrlId: string): Promise<IndexabilityRecord[]>;
  recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): Promise<IndexabilityRecord>;
  // --- Resumable BFS frontier (migration 016), keyed by crawl run. ---
  enqueueCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, entries: Array<Pick<CrawlFrontierEntry, "normalizedUrl" | "depth" | "discoveredFrom">>): Promise<{ enqueued: number; pending: number }>;
  claimCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, limit: number): Promise<{ items: CrawlFrontierEntry[]; pending: number }>;
  completeCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, normalizedUrls: string[]): Promise<{ done: number; pending: number }>;
  countPendingCrawlFrontier(projectId: string, siteId: string, crawlRunId: string): Promise<number>;
  // --- Durable per-page audit signals for resumable finalization (migration 017). ---
  recordCrawlPageSignals(projectId: string, siteId: string, crawlRunId: string, signals: Array<Omit<CrawlPageSignal, "crawlRunId">>): Promise<{ recorded: number }>;
  listCrawlPageSignals(projectId: string, siteId: string, crawlRunId: string): Promise<CrawlPageSignal[]>;
}

export function createCrawlStore(db: AsyncDatabase, audit: AuditLog): CrawlStore {
  return new SQLiteCrawlStore(db, audit);
}

function mapCrawlFrontierEntry(crawlRunId: string, row: unknown): CrawlFrontierEntry {
  const record = row as { normalized_url: string; depth: number; discovered_from: string | null; status: string };
  return {
    crawlRunId,
    normalizedUrl: String(record.normalized_url),
    depth: Number(record.depth),
    discoveredFrom: record.discovered_from ?? null,
    status: record.status as CrawlFrontierEntry["status"]
  };
}

function mapCrawlPageSignal(crawlRunId: string, row: unknown): CrawlPageSignal {
  const record = row as { normalized_url: string; final_url: string; status_code: number | null; title: string | null; canonical_url: string | null; outgoing_links: string };
  let outgoingLinks: Array<{ url: string; statusCode: number | null }> = [];
  try {
    const parsed = JSON.parse(record.outgoing_links ?? "[]");
    if (Array.isArray(parsed)) outgoingLinks = parsed;
  } catch {
    // Corrupt JSON degrades to no outgoing links rather than throwing.
  }
  return {
    crawlRunId,
    normalizedUrl: String(record.normalized_url),
    finalUrl: String(record.final_url),
    statusCode: record.status_code === null || record.status_code === undefined ? null : Number(record.status_code),
    title: record.title ?? null,
    canonicalUrl: record.canonical_url ?? null,
    outgoingLinks
  };
}

function normalizePageOptions(options: ListPageOptions): Required<ListPageOptions> {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 50), 200));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  return { limit, offset };
}

function createListPage<T>(data: T[], limit: number, offset: number, total: number): ListPage<T> {
  const nextOffset = offset + data.length;
  return {
    data,
    limit,
    offset,
    total,
    nextCursor: nextOffset < total ? encodeCursor(nextOffset) : null
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(`offset:${offset}`, "utf8").toString("base64url");
}

async function pageTotal(db: AsyncDatabase, tableName: string, whereSql: string, params: unknown[]): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE ${whereSql}`).get(...params);
  return Number(row?.count ?? 0);
}

function discoveredUrlWhere(projectId: string, siteId: string, filters: DiscoveredUrlListFilters): { whereSql: string; params: unknown[] } {
  const where = [`project_id = ?`, `site_id = ?`];
  const params: unknown[] = [projectId, siteId];
  if (filters.source) {
    where.push(`source = ?`);
    params.push(filters.source);
  }
  if (filters.status) {
    where.push(`(SELECT fetch.status_class FROM url_fetch_results fetch WHERE fetch.discovered_url_id = discovered_urls.id ORDER BY fetch.fetched_at DESC, fetch.created_at DESC, fetch.id ASC LIMIT 1) = ?`);
    params.push(filters.status);
  }
  const q = filters.q?.trim();
  if (q) {
    // Case-insensitive substring search; escape LIKE wildcards so user input is literal.
    const escaped = q.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`);
    where.push(`LOWER(url) LIKE ? ESCAPE '\\'`);
    params.push(`%${escaped}%`);
  }
  return { whereSql: where.join(" AND "), params };
}

function mapUrlExplorerRow(row: Record<string, unknown>): UrlExplorerRow {
  return {
    discoveredUrl: mapDiscoveredUrl({
      id: row.url_id,
      project_id: row.url_project_id,
      site_id: row.url_site_id,
      url: row.url_url,
      normalized_url: row.url_normalized_url,
      source: row.url_source,
      discovered_from: row.url_discovered_from,
      depth: row.url_depth,
      discovered_at: row.url_discovered_at
    }),
    latestFetch: row.fetch_id === null ? null : mapUrlFetchRecord({
      id: row.fetch_id,
      project_id: row.fetch_project_id,
      site_id: row.fetch_site_id,
      discovered_url_id: row.fetch_discovered_url_id,
      url: row.fetch_url,
      final_url: row.fetch_final_url,
      status_code: row.fetch_status_code,
      status_class: row.fetch_status_class,
      headers: row.fetch_headers,
      redirect_chain: row.fetch_redirect_chain,
      fetched_at: row.fetch_fetched_at,
      error_message: row.fetch_error_message
    }),
    latestIndexability: row.index_id === null ? null : mapIndexabilityRecord({
      id: row.index_id,
      project_id: row.index_project_id,
      site_id: row.index_site_id,
      discovered_url_id: row.index_discovered_url_id,
      fetch_result_id: row.index_fetch_result_id,
      url: row.index_url,
      state: row.index_state,
      is_indexable: row.index_is_indexable,
      reasons: row.index_reasons,
      canonical_url: row.index_canonical_url,
      assessed_at: row.index_assessed_at
    })
  };
}

class SQLiteCrawlStore implements CrawlStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  async listCrawlRuns(projectId: string, siteId: string): Promise<CrawlRun[]> {
    return (await this.db.prepare(`SELECT * FROM crawl_runs WHERE project_id = ? AND site_id = ? ORDER BY started_at DESC`).all(projectId, siteId)).map(mapCrawlRun);
  }

  async listCrawlRunsPage(projectId: string, siteId: string, options: ListPageOptions = {}, filters: CrawlRunListFilters = {}): Promise<ListPage<CrawlRun>> {
    const { limit, offset } = normalizePageOptions(options);
    const where = [`project_id = ?`, `site_id = ?`];
    const params: unknown[] = [projectId, siteId];
    if (filters.status) {
      where.push(`status = ?`);
      params.push(filters.status);
    }
    const whereSql = where.join(" AND ");
    const total = await pageTotal(this.db, `crawl_runs`, whereSql, params);
    const data = (await this.db.prepare(`
      SELECT * FROM crawl_runs
      WHERE ${whereSql}
      ORDER BY started_at DESC, id ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)).map(mapCrawlRun);
    return createListPage(data, limit, offset, total);
  }

  async getCrawlRun(projectId: string, siteId: string, runId: string): Promise<CrawlRun | null> {
    const row = await this.db.prepare(`SELECT * FROM crawl_runs WHERE id = ? AND project_id = ? AND site_id = ?`).get(runId, projectId, siteId);
    return row ? mapCrawlRun(row) : null;
  }

  async createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): Promise<CrawlRun> {
    await this.assertSiteScope(projectId, siteId);
    const now = new Date().toISOString();
    const run: CrawlRun = {
      id: `crawl-${randomUUID()}`,
      projectId,
      siteId,
      status: "running",
      trigger,
      startedAt: now,
      finishedAt: null,
      summary: emptyCrawlRunSummary()
    };
    await this.db.prepare(`
      INSERT INTO crawl_runs (id, project_id, site_id, status, trigger, started_at, finished_at, summary, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(run.id, projectId, siteId, run.status, run.trigger, run.startedAt, run.finishedAt, JSON.stringify(run.summary), null);
    await this.audit("system", "crawl.run.create", "crawl_run", run.id, { projectId, siteId, trigger });
    return run;
  }

  async completeCrawlRun(projectId: string, siteId: string, runId: string, status: Extract<CrawlRun["status"], "succeeded" | "failed">, errorMessage?: string): Promise<CrawlRun> {
    const summary = await this.crawlRunSummary(projectId, siteId);
    const now = new Date().toISOString();
    await this.db.prepare(`
      UPDATE crawl_runs
      SET status = ?, finished_at = ?, summary = ?, error_message = ?
      WHERE id = ? AND project_id = ? AND site_id = ?
    `).run(status, now, JSON.stringify(summary), errorMessage ?? null, runId, projectId, siteId);
    const row = await this.db.prepare(`SELECT * FROM crawl_runs WHERE id = ? AND project_id = ? AND site_id = ?`).get(runId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "crawl_run_not_found", "Crawl run not found", { projectId, siteId, runId });
    }
    await this.audit("system", "crawl.run.complete", "crawl_run", runId, { projectId, siteId, status });
    return mapCrawlRun(row);
  }

  async listHealthScores(projectId: string, siteId: string): Promise<CrawlHealthScore[]> {
    return (await this.db.prepare(`SELECT * FROM crawl_health_scores WHERE project_id = ? AND site_id = ? ORDER BY generated_at DESC`).all(projectId, siteId)).map(mapCrawlHealthScore);
  }

  async computeHealthScore(projectId: string, siteId: string): Promise<CrawlHealthScore> {
    await this.assertSiteScope(projectId, siteId);
    const openIssues = (await this.listAuditIssues(projectId, siteId)).filter((issue) => issue.resolvedAt === null && issue.dismissedAt === null);
    const issueCounts = countIssueSeverities(openIssues);
    const score: CrawlHealthScore = {
      id: `health-${randomUUID()}`,
      projectId,
      siteId,
      score: calculateHealthScore(openIssues),
      totalIssues: openIssues.length,
      issueCounts,
      generatedAt: new Date().toISOString()
    };
    await this.db.prepare(`
      INSERT INTO crawl_health_scores (id, project_id, site_id, score, total_issues, issue_counts, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(score.id, projectId, siteId, score.score, score.totalIssues, JSON.stringify(score.issueCounts), score.generatedAt);
    await this.audit("system", "crawl.health.compute", "site", siteId, { projectId, score: score.score, totalIssues: score.totalIssues });
    return score;
  }

  async listAuditIssues(projectId: string, siteId: string): Promise<AuditIssueRecord[]> {
    return (await this.db.prepare(`SELECT * FROM audit_issues WHERE project_id = ? AND site_id = ? ORDER BY detected_at DESC, severity ASC`).all(projectId, siteId)).map(mapAuditIssueRecord);
  }

  async listAuditIssuesPage(projectId: string, siteId: string, options: ListPageOptions = {}, filters: AuditIssueListFilters = {}): Promise<ListPage<AuditIssueRecord>> {
    const { limit, offset } = normalizePageOptions(options);
    const where = [`project_id = ?`, `site_id = ?`];
    const params: unknown[] = [projectId, siteId];
    if (filters.status === "open") {
      where.push(`resolved_at IS NULL AND dismissed_at IS NULL`);
    } else if (filters.status === "resolved") {
      where.push(`(resolved_at IS NOT NULL OR dismissed_at IS NOT NULL)`);
    }
    if (filters.severity) {
      where.push(`severity = ?`);
      params.push(filters.severity);
    }
    if (filters.rule) {
      where.push(`rule = ?`);
      params.push(filters.rule);
    }
    const whereSql = where.join(" AND ");
    const total = await pageTotal(this.db, `audit_issues`, whereSql, params);
    const data = (await this.db.prepare(`
      SELECT * FROM audit_issues
      WHERE ${whereSql}
      ORDER BY detected_at DESC, severity ASC, id ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)).map(mapAuditIssueRecord);
    return createListPage(data, limit, offset, total);
  }

  async listTopOpenAuditIssuesByProject(projectId: string, limit: number): Promise<AuditIssueRecord[]> {
    // One query across all sites in the project, severity-ranked in SQL so the MCP
    // summary no longer over-fetches up to 200 issues per site just to keep the top few.
    return (await this.db.prepare(`
      SELECT * FROM audit_issues
      WHERE project_id = ? AND resolved_at IS NULL AND dismissed_at IS NULL
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC,
        detected_at DESC, id ASC
      LIMIT ?
    `).all(projectId, limit)).map(mapAuditIssueRecord);
  }

  async recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[], scope: RecordAuditIssuesScope): Promise<{ issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number }> {
    await this.assertSiteScope(projectId, siteId);
    const checkedDiscoveredUrlIds = [...new Set(scope.checkedDiscoveredUrlIds)];
    const checkedDiscoveredUrlIdSet = new Set(checkedDiscoveredUrlIds);

    // One batched fetch replaces both the per-id scope-assert loop and the per-id url
    // lookup (previously 2 Postgres round-trips per checked URL). Each `?` is translated
    // positionally to $N (db/sql-translate.ts), so a dynamic IN-list binds correctly on
    // both Neon and PGlite.
    const checkedUrlRowById = new Map<string, { url: string; normalized_url: string }>();
    if (checkedDiscoveredUrlIds.length > 0) {
      const placeholders = checkedDiscoveredUrlIds.map(() => "?").join(", ");
      const rows = await this.db.prepare(
        `SELECT id, url, normalized_url FROM discovered_urls WHERE id IN (${placeholders}) AND project_id = ? AND site_id = ?`
      ).all(...checkedDiscoveredUrlIds, projectId, siteId);
      for (const row of rows) {
        checkedUrlRowById.set(String(row.id), { url: String(row.url), normalized_url: String(row.normalized_url) });
      }
      // Preserve the scope assert: every checked id must exist in this project/site scope.
      for (const discoveredUrlId of checkedDiscoveredUrlIds) {
        if (!checkedUrlRowById.has(discoveredUrlId)) {
          throw new RequestError(404, "unknown_discovered_url", "Referenced discovered URL does not exist", { projectId, siteId, discoveredUrlId });
        }
      }
    }
    // Index-aligned to checkedDiscoveredUrlIds for the stale-issue query below.
    const checkedUrlRows = checkedDiscoveredUrlIds.map((id) => checkedUrlRowById.get(id) ?? null);
    const checkedUrlSet = new Set(checkedUrlRows.flatMap((row) => (row ? [String(row.url), String(row.normalized_url)] : [])));

    for (const issue of issues) {
      if (issue.projectId !== projectId || issue.siteId !== siteId) {
        throw new RequestError(400, "issue_scope_mismatch", "Audit issue projectId/siteId must match the route scope", { issueId: issue.id });
      }
      if (issue.discoveredUrlId) {
        // Checked ids were already proven to exist via the batched fetch above, so skip
        // the per-issue DB assert for them. Ids outside the checked set keep the exact
        // prior behavior: assert existence first (may throw unknown_discovered_url), then
        // reject as out-of-scope.
        if (!checkedDiscoveredUrlIdSet.has(issue.discoveredUrlId)) {
          await this.assertDiscoveredUrlScope(projectId, siteId, issue.discoveredUrlId);
          throw new RequestError(400, "issue_scope_mismatch", "Audit issue discoveredUrlId must be included in checkedDiscoveredUrlIds", { issueId: issue.id, discoveredUrlId: issue.discoveredUrlId });
        }
      } else if (checkedDiscoveredUrlIds.length > 0 && !checkedUrlSet.has(issue.url)) {
        throw new RequestError(400, "issue_scope_mismatch", "Audit issue URL must be included in checkedDiscoveredUrlIds scope when discoveredUrlId is null", { issueId: issue.id, url: issue.url });
      }
    }

    let inserted = 0;
    let updated = 0;
    let resolved = 0;
    const now = new Date().toISOString();
    const submittedIssueIds = new Set(issues.map((issue) => issue.id));

    if (checkedDiscoveredUrlIds.length > 0) {
      const openScopedIssues = this.db.prepare(`SELECT id FROM audit_issues WHERE project_id = ? AND site_id = ? AND resolved_at IS NULL AND dismissed_at IS NULL AND (discovered_url_id = ? OR url = ? OR url = ?)`);
      const staleIssueIds = [...new Set((await Promise.all(checkedDiscoveredUrlIds.map(async (discoveredUrlId, index) => {
        const checkedUrlRow = checkedUrlRows[index];
        return (await openScopedIssues.all(projectId, siteId, discoveredUrlId, String(checkedUrlRow?.url ?? ""), String(checkedUrlRow?.normalized_url ?? ""))).map((row) => String(row.id));
      }))).flat())].filter((id) => !submittedIssueIds.has(id));

      if (staleIssueIds.length > 0) {
        const resolveStaleIssue = this.db.prepare(`UPDATE audit_issues SET resolved_at = ?, updated_at = ? WHERE id = ? AND project_id = ? AND site_id = ? AND resolved_at IS NULL`);
        for (const issueId of staleIssueIds) {
          const result = await resolveStaleIssue.run(now, now, issueId, projectId, siteId);
          resolved += Number(result.changes ?? 0);
        }
      }
    }

    // One batched existence check replaces the per-issue SELECT that only fed the
    // inserted-vs-updated counter (the ON CONFLICT below already upserts correctly).
    const existingIssueIds = new Set<string>();
    if (issues.length > 0) {
      const ids = issues.map((issue) => issue.id);
      const placeholders = ids.map(() => "?").join(", ");
      const existingRows = await this.db.prepare(`SELECT id FROM audit_issues WHERE id IN (${placeholders})`).all(...ids);
      for (const row of existingRows) existingIssueIds.add(String(row.id));
    }

    for (const issue of issues) {
      const existing = existingIssueIds.has(issue.id);
      await this.db.prepare(`
        INSERT INTO audit_issues (id, project_id, site_id, discovered_url_id, url, rule, severity, message, detected_at, resolved_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          discovered_url_id = excluded.discovered_url_id,
          url = excluded.url,
          rule = excluded.rule,
          severity = excluded.severity,
          message = excluded.message,
          detected_at = excluded.detected_at,
          resolved_at = excluded.resolved_at,
          updated_at = excluded.updated_at
      `).run(issue.id, projectId, siteId, issue.discoveredUrlId, issue.url, issue.rule, issue.severity, issue.message, issue.detectedAt, issue.resolvedAt, now);
      // Keep the counter exact even if `issues` repeats an id within one call: a freshly
      // inserted id counts as updated on its next occurrence (matches the old per-row SELECT).
      if (existing) {
        updated += 1;
      } else {
        inserted += 1;
        existingIssueIds.add(issue.id);
      }
    }
    const stored = await this.listAuditIssues(projectId, siteId);
    await this.audit("system", "crawl.issues.record", "site", siteId, { projectId, checkedDiscoveredUrlIds, inserted, updated, resolved, total: stored.length });
    return { issues: stored, inserted, updated, resolved };
  }

  async resolveAuditIssue(projectId: string, siteId: string, issueId: string, actor = "system"): Promise<AuditIssueRecord> {
    const now = new Date().toISOString();
    return this.applyAuditIssueTransition(projectId, siteId, issueId, "resolve", actor, {
      resolvedAt: now,
      dismissedAt: null,
      dismissReason: null
    });
  }

  async dismissAuditIssue(projectId: string, siteId: string, issueId: string, reason: string | null = null, actor = "system"): Promise<AuditIssueRecord> {
    const now = new Date().toISOString();
    return this.applyAuditIssueTransition(projectId, siteId, issueId, "dismiss", actor, {
      // A dismissed issue is distinct from a resolved one: it has a dismissed_at
      // timestamp + reason and an explicitly null resolved_at.
      resolvedAt: null,
      dismissedAt: now,
      dismissReason: reason
    }, reason);
  }

  async reopenAuditIssue(projectId: string, siteId: string, issueId: string, actor = "system"): Promise<AuditIssueRecord> {
    return this.applyAuditIssueTransition(projectId, siteId, issueId, "reopen", actor, {
      resolvedAt: null,
      dismissedAt: null,
      dismissReason: null
    });
  }

  async listAuditIssueHistory(projectId: string, siteId: string, issueId: string): Promise<AuditIssueHistoryEntry[]> {
    await this.assertAuditIssueScope(projectId, siteId, issueId);
    return (await this.db.prepare(`
      SELECT * FROM audit_issue_history
      WHERE project_id = ? AND site_id = ? AND issue_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(projectId, siteId, issueId)).map(mapAuditIssueHistoryEntry);
  }

  private async applyAuditIssueTransition(
    projectId: string,
    siteId: string,
    issueId: string,
    action: "resolve" | "dismiss" | "reopen",
    actor: string,
    state: { resolvedAt: string | null; dismissedAt: string | null; dismissReason: string | null },
    reason: string | null = null
  ): Promise<AuditIssueRecord> {
    await this.assertSiteScope(projectId, siteId);
    const now = new Date().toISOString();
    const resolvedBy = action === "resolve" ? actor : null;
    const dismissedBy = action === "dismiss" ? actor : null;
    const result = await this.db.prepare(`
      UPDATE audit_issues
      SET resolved_at = ?, dismissed_at = ?, dismiss_reason = ?, resolved_by = ?, dismissed_by = ?, last_actor = ?, updated_at = ?
      WHERE id = ? AND project_id = ? AND site_id = ?
    `).run(state.resolvedAt, state.dismissedAt, state.dismissReason, resolvedBy, dismissedBy, actor, now, issueId, projectId, siteId);
    if (Number(result.changes ?? 0) === 0) {
      throw new RequestError(404, "audit_issue_not_found", "Audit issue not found", { projectId, siteId, issueId });
    }
    const row = await this.db.prepare(`SELECT * FROM audit_issues WHERE id = ? AND project_id = ? AND site_id = ?`).get(issueId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "audit_issue_not_found", "Audit issue not found", { projectId, siteId, issueId });
    }
    // Record a queryable per-issue history entry in addition to the global audit log.
    await this.db.prepare(`
      INSERT INTO audit_issue_history (id, project_id, site_id, issue_id, action, actor, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`aih-${randomUUID()}`, projectId, siteId, issueId, action, actor, reason, now);
    await this.audit(actor, `crawl.issue.${action}`, "audit_issue", issueId, { projectId, siteId, reason });
    return mapAuditIssueRecord(row);
  }

  async listDiscoveredUrls(projectId: string, siteId?: string): Promise<DiscoveredUrl[]> {
    const sql = siteId
      ? `SELECT * FROM discovered_urls WHERE project_id = ? AND site_id = ? ORDER BY discovered_at ASC, normalized_url ASC`
      : `SELECT * FROM discovered_urls WHERE project_id = ? ORDER BY discovered_at ASC, normalized_url ASC`;
    const rows = siteId
      ? await this.db.prepare(sql).all(projectId, siteId)
      : await this.db.prepare(sql).all(projectId);
    return rows.map(mapDiscoveredUrl);
  }

  async findDiscoveredUrlInProject(projectId: string, url: string, siteId?: string): Promise<DiscoveredUrl | null> {
    // Single indexed lookup by url OR normalized_url, replacing an O(sites × pages) scan.
    const row = siteId
      ? await this.db.prepare(`SELECT * FROM discovered_urls WHERE project_id = ? AND site_id = ? AND (url = ? OR normalized_url = ?) LIMIT 1`).get(projectId, siteId, url, url)
      : await this.db.prepare(`SELECT * FROM discovered_urls WHERE project_id = ? AND (url = ? OR normalized_url = ?) LIMIT 1`).get(projectId, url, url);
    return row ? mapDiscoveredUrl(row) : null;
  }

  async listDiscoveredUrlsPage(projectId: string, siteId: string, options: ListPageOptions = {}, filters: DiscoveredUrlListFilters = {}): Promise<ListPage<DiscoveredUrl>> {
    const { limit, offset } = normalizePageOptions(options);
    const { whereSql, params } = discoveredUrlWhere(projectId, siteId, filters);
    const total = await pageTotal(this.db, `discovered_urls`, whereSql, params);
    const data = (await this.db.prepare(`
      SELECT * FROM discovered_urls
      WHERE ${whereSql}
      ORDER BY discovered_at ASC, normalized_url ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)).map(mapDiscoveredUrl);
    return createListPage(data, limit, offset, total);
  }

  async listUrlExplorerRows(projectId: string, siteId: string, options: ListPageOptions = {}, filters: DiscoveredUrlListFilters = {}): Promise<ListPage<UrlExplorerRow>> {
    const { limit, offset } = normalizePageOptions(options);
    const { whereSql, params } = discoveredUrlWhere(projectId, siteId, filters);
    const total = await pageTotal(this.db, `discovered_urls`, whereSql, params);
    const rows = (await this.db.prepare(`
      WITH paged_urls AS (
        SELECT * FROM discovered_urls
        WHERE ${whereSql}
        ORDER BY discovered_at ASC, normalized_url ASC
        LIMIT ? OFFSET ?
      ),
      latest_fetches AS (
        SELECT * FROM (
          SELECT fr.*, ROW_NUMBER() OVER (PARTITION BY fr.discovered_url_id ORDER BY fr.fetched_at DESC, fr.created_at DESC, fr.id ASC) AS row_number
          FROM url_fetch_results fr
          INNER JOIN paged_urls url ON url.id = fr.discovered_url_id
        )
        WHERE row_number = 1
      ),
      latest_indexability AS (
        SELECT * FROM (
          SELECT assessment.*, ROW_NUMBER() OVER (PARTITION BY assessment.discovered_url_id ORDER BY assessment.assessed_at DESC, assessment.created_at DESC, assessment.id ASC) AS row_number
          FROM url_indexability_assessments assessment
          INNER JOIN paged_urls url ON url.id = assessment.discovered_url_id
        )
        WHERE row_number = 1
      )
      SELECT
        url.id AS url_id, url.project_id AS url_project_id, url.site_id AS url_site_id, url.url AS url_url, url.normalized_url AS url_normalized_url, url.source AS url_source, url.discovered_from AS url_discovered_from, url.depth AS url_depth, url.discovered_at AS url_discovered_at,
        fr.id AS fetch_id, fr.project_id AS fetch_project_id, fr.site_id AS fetch_site_id, fr.discovered_url_id AS fetch_discovered_url_id, fr.url AS fetch_url, fr.final_url AS fetch_final_url, fr.status_code AS fetch_status_code, fr.status_class AS fetch_status_class, fr.headers AS fetch_headers, fr.redirect_chain AS fetch_redirect_chain, fr.fetched_at AS fetch_fetched_at, fr.error_message AS fetch_error_message,
        assessment.id AS index_id, assessment.project_id AS index_project_id, assessment.site_id AS index_site_id, assessment.discovered_url_id AS index_discovered_url_id, assessment.fetch_result_id AS index_fetch_result_id, assessment.url AS index_url, assessment.state AS index_state, assessment.is_indexable AS index_is_indexable, assessment.reasons AS index_reasons, assessment.canonical_url AS index_canonical_url, assessment.assessed_at AS index_assessed_at
      FROM paged_urls url
      LEFT JOIN latest_fetches fr ON fr.discovered_url_id = url.id
      LEFT JOIN latest_indexability assessment ON assessment.discovered_url_id = url.id
      ORDER BY url.discovered_at ASC, url.normalized_url ASC
    `).all(...params, limit, offset)).map(mapUrlExplorerRow);
    return createListPage(rows, limit, offset, total);
  }

  async recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): Promise<{ urls: DiscoveredUrl[]; inserted: number; updated: number }> {
    const site = await this.db.prepare(`SELECT id FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!site) {
      throw new RequestError(404, "unknown_site", "Referenced site does not exist", { projectId, siteId });
    }

    let inserted = 0;
    let updated = 0;
    const now = new Date().toISOString();

    for (const url of urls) {
      if (url.projectId !== projectId || url.siteId !== siteId) {
        throw new RequestError(400, "url_scope_mismatch", "Discovered URL projectId/siteId must match the route scope", { url: url.normalizedUrl });
      }
      const existing = await this.db.prepare(`SELECT id FROM discovered_urls WHERE project_id = ? AND site_id = ? AND normalized_url = ?`).get(projectId, siteId, url.normalizedUrl);
      await this.db.prepare(`
        INSERT INTO discovered_urls (id, project_id, site_id, url, normalized_url, source, discovered_from, depth, discovered_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, site_id, normalized_url) DO UPDATE SET
          url = excluded.url,
          source = excluded.source,
          discovered_from = excluded.discovered_from,
          depth = excluded.depth,
          discovered_at = excluded.discovered_at,
          updated_at = excluded.updated_at
      `).run(url.id, projectId, siteId, url.url, url.normalizedUrl, url.source, url.discoveredFrom, url.depth, url.discoveredAt, now);
      if (existing) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    const stored = await this.listDiscoveredUrls(projectId, siteId);
    await this.audit("system", "crawl.discovery.record", "site", siteId, { projectId, inserted, updated, total: stored.length });
    return { urls: stored, inserted, updated };
  }

  async listFetchResults(projectId: string, siteId: string, discoveredUrlId: string): Promise<UrlFetchRecord[]> {
    await this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    return (await this.db.prepare(`
      SELECT * FROM url_fetch_results
      WHERE project_id = ? AND site_id = ? AND discovered_url_id = ?
      ORDER BY fetched_at DESC, created_at DESC
    `).all(projectId, siteId, discoveredUrlId)).map(mapUrlFetchRecord);
  }

  async recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): Promise<UrlFetchRecord> {
    await this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    const id = `fetch-${randomUUID()}`;
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO url_fetch_results (id, project_id, site_id, discovered_url_id, url, final_url, status_code, status_class, headers, redirect_chain, fetched_at, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      siteId,
      discoveredUrlId,
      result.url,
      result.finalUrl,
      result.statusCode,
      result.statusClass,
      JSON.stringify(result.headers),
      JSON.stringify(result.redirectChain),
      result.fetchedAt,
      result.errorMessage ?? null,
      now
    );
    await this.audit("system", "crawl.fetch.record", "discovered_url", discoveredUrlId, { projectId, siteId, statusClass: result.statusClass, statusCode: result.statusCode });
    const row = await this.db.prepare(`SELECT * FROM url_fetch_results WHERE id = ?`).get(id);
    if (!row) {
      throw new RequestError(400, "fetch_result_write_failed", "Fetch result could not be stored");
    }
    return mapUrlFetchRecord(row);
  }

  async listIndexabilityAssessments(projectId: string, siteId: string, discoveredUrlId: string): Promise<IndexabilityRecord[]> {
    await this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    return (await this.db.prepare(`
      SELECT * FROM url_indexability_assessments
      WHERE project_id = ? AND site_id = ? AND discovered_url_id = ?
      ORDER BY assessed_at DESC, created_at DESC
    `).all(projectId, siteId, discoveredUrlId)).map(mapIndexabilityRecord);
  }

  async recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): Promise<IndexabilityRecord> {
    await this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    if (assessment.fetchResultId) {
      await this.assertFetchResultScope(projectId, siteId, discoveredUrlId, assessment.fetchResultId);
    }
    const id = `index-${randomUUID()}`;
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO url_indexability_assessments (id, project_id, site_id, discovered_url_id, fetch_result_id, url, state, is_indexable, reasons, canonical_url, assessed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      siteId,
      discoveredUrlId,
      assessment.fetchResultId,
      assessment.url,
      assessment.state,
      assessment.isIndexable ? 1 : 0,
      JSON.stringify(assessment.reasons),
      assessment.canonicalUrl,
      assessment.assessedAt,
      now
    );
    await this.audit("system", "crawl.indexability.record", "discovered_url", discoveredUrlId, { projectId, siteId, state: assessment.state, isIndexable: assessment.isIndexable });
    const row = await this.db.prepare(`SELECT * FROM url_indexability_assessments WHERE id = ?`).get(id);
    if (!row) {
      throw new RequestError(400, "indexability_write_failed", "Indexability assessment could not be stored");
    }
    return mapIndexabilityRecord(row);
  }

  // --- Resumable BFS frontier (migration 016) --------------------------------

  async enqueueCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, entries: Array<Pick<CrawlFrontierEntry, "normalizedUrl" | "depth" | "discoveredFrom">>): Promise<{ enqueued: number; pending: number }> {
    await this.assertCrawlRunScope(projectId, siteId, crawlRunId);
    const now = new Date().toISOString();
    let enqueued = 0;
    for (const entry of entries) {
      // ON CONFLICT DO NOTHING: a URL already in this run's frontier keeps its status.
      const result = await this.db.prepare(`
        INSERT INTO crawl_frontier (id, crawl_run_id, project_id, site_id, normalized_url, depth, discovered_from, status, enqueued_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        ON CONFLICT(crawl_run_id, normalized_url) DO NOTHING
      `).run(`frontier-${randomUUID()}`, crawlRunId, projectId, siteId, entry.normalizedUrl, entry.depth, entry.discoveredFrom ?? null, now, now);
      if (Number((result as { changes?: number })?.changes ?? 0) > 0) enqueued += 1;
    }
    return { enqueued, pending: await this.countPendingCrawlFrontier(projectId, siteId, crawlRunId) };
  }

  async claimCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, limit: number): Promise<{ items: CrawlFrontierEntry[]; pending: number }> {
    await this.assertCrawlRunScope(projectId, siteId, crawlRunId);
    const batch = Math.max(1, Math.min(Math.trunc(limit) || 1, 200));
    // Shallowest-first (BFS order). A single worker owns a run at a time (job lease),
    // so a select-then-mark is race-safe enough; in_progress guards accidental overlap.
    const rows = await this.db.prepare(`
      SELECT normalized_url, depth, discovered_from, status FROM crawl_frontier
      WHERE crawl_run_id = ? AND status = 'pending'
      ORDER BY depth ASC, enqueued_at ASC
      LIMIT ?
    `).all(crawlRunId, batch);
    const now = new Date().toISOString();
    for (const row of rows) {
      await this.db.prepare(`UPDATE crawl_frontier SET status = 'in_progress', updated_at = ? WHERE crawl_run_id = ? AND normalized_url = ?`).run(now, crawlRunId, String((row as { normalized_url: string }).normalized_url));
    }
    const items: CrawlFrontierEntry[] = rows.map((row) => mapCrawlFrontierEntry(crawlRunId, row));
    return { items, pending: await this.countPendingCrawlFrontier(projectId, siteId, crawlRunId) };
  }

  async completeCrawlFrontier(projectId: string, siteId: string, crawlRunId: string, normalizedUrls: string[]): Promise<{ done: number; pending: number }> {
    await this.assertCrawlRunScope(projectId, siteId, crawlRunId);
    const now = new Date().toISOString();
    let done = 0;
    for (const normalizedUrl of normalizedUrls) {
      const result = await this.db.prepare(`UPDATE crawl_frontier SET status = 'done', updated_at = ? WHERE crawl_run_id = ? AND normalized_url = ? AND status != 'done'`).run(now, crawlRunId, normalizedUrl);
      done += Number((result as { changes?: number })?.changes ?? 0);
    }
    return { done, pending: await this.countPendingCrawlFrontier(projectId, siteId, crawlRunId) };
  }

  async countPendingCrawlFrontier(_projectId: string, _siteId: string, crawlRunId: string): Promise<number> {
    const row = await this.db.prepare(`SELECT COUNT(*) AS count FROM crawl_frontier WHERE crawl_run_id = ? AND status IN ('pending', 'in_progress')`).get(crawlRunId);
    return Number((row as { count?: number })?.count ?? 0);
  }

  async recordCrawlPageSignals(projectId: string, siteId: string, crawlRunId: string, signals: Array<Omit<CrawlPageSignal, "crawlRunId">>): Promise<{ recorded: number }> {
    await this.assertCrawlRunScope(projectId, siteId, crawlRunId);
    const now = new Date().toISOString();
    for (const signal of signals) {
      await this.db.prepare(`
        INSERT INTO crawl_page_signals (id, crawl_run_id, project_id, site_id, normalized_url, final_url, status_code, title, canonical_url, outgoing_links, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(crawl_run_id, normalized_url) DO UPDATE SET
          final_url = excluded.final_url,
          status_code = excluded.status_code,
          title = excluded.title,
          canonical_url = excluded.canonical_url,
          outgoing_links = excluded.outgoing_links
      `).run(`signal-${randomUUID()}`, crawlRunId, projectId, siteId, signal.normalizedUrl, signal.finalUrl, signal.statusCode, signal.title, signal.canonicalUrl, JSON.stringify(signal.outgoingLinks ?? []), now);
    }
    return { recorded: signals.length };
  }

  async listCrawlPageSignals(projectId: string, siteId: string, crawlRunId: string): Promise<CrawlPageSignal[]> {
    await this.assertCrawlRunScope(projectId, siteId, crawlRunId);
    const rows = await this.db.prepare(`SELECT * FROM crawl_page_signals WHERE crawl_run_id = ? ORDER BY created_at ASC`).all(crawlRunId);
    return rows.map((row) => mapCrawlPageSignal(crawlRunId, row));
  }

  private async assertCrawlRunScope(projectId: string, siteId: string, crawlRunId: string): Promise<void> {
    const row = await this.db.prepare(`SELECT id FROM crawl_runs WHERE id = ? AND project_id = ? AND site_id = ?`).get(crawlRunId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "crawl_run_not_found", "Referenced crawl run does not exist", { projectId, siteId, crawlRunId });
    }
  }

  private async assertSiteScope(projectId: string, siteId: string): Promise<void> {
    const row = await this.db.prepare(`SELECT id FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!row) {
      throw new RequestError(404, "unknown_site", "Referenced site does not exist", { projectId, siteId });
    }
  }

  private async crawlRunSummary(projectId: string, siteId: string): Promise<CrawlRun["summary"]> {
    const discoveredUrls = Number((await this.db.prepare(`SELECT COUNT(*) AS count FROM discovered_urls WHERE project_id = ? AND site_id = ?`).get(projectId, siteId))?.count ?? 0);
    const fetchedUrls = Number((await this.db.prepare(`SELECT COUNT(*) AS count FROM url_fetch_results WHERE project_id = ? AND site_id = ?`).get(projectId, siteId))?.count ?? 0);
    const indexabilityAssessments = Number((await this.db.prepare(`SELECT COUNT(*) AS count FROM url_indexability_assessments WHERE project_id = ? AND site_id = ?`).get(projectId, siteId))?.count ?? 0);
    const openIssues = Number((await this.db.prepare(`SELECT COUNT(*) AS count FROM audit_issues WHERE project_id = ? AND site_id = ? AND resolved_at IS NULL AND dismissed_at IS NULL`).get(projectId, siteId))?.count ?? 0);
    const healthRow = await this.db.prepare(`SELECT score FROM crawl_health_scores WHERE project_id = ? AND site_id = ? ORDER BY generated_at DESC LIMIT 1`).get(projectId, siteId);
    return { discoveredUrls, fetchedUrls, indexabilityAssessments, openIssues, healthScore: healthRow ? Number(healthRow.score) : null };
  }

  private async assertAuditIssueScope(projectId: string, siteId: string, issueId: string): Promise<void> {
    const row = await this.db.prepare(`SELECT id FROM audit_issues WHERE id = ? AND project_id = ? AND site_id = ?`).get(issueId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "audit_issue_not_found", "Audit issue not found", { projectId, siteId, issueId });
    }
  }

  private async assertDiscoveredUrlScope(projectId: string, siteId: string, discoveredUrlId: string): Promise<void> {
    const row = await this.db.prepare(`SELECT id FROM discovered_urls WHERE id = ? AND project_id = ? AND site_id = ?`).get(discoveredUrlId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "unknown_discovered_url", "Referenced discovered URL does not exist", { projectId, siteId, discoveredUrlId });
    }
  }

  private async assertFetchResultScope(projectId: string, siteId: string, discoveredUrlId: string, fetchResultId: string): Promise<void> {
    const row = await this.db.prepare(`
      SELECT id FROM url_fetch_results
      WHERE id = ? AND project_id = ? AND site_id = ? AND discovered_url_id = ?
    `).get(fetchResultId, projectId, siteId, discoveredUrlId);
    if (!row) {
      throw new RequestError(404, "unknown_fetch_result", "Referenced fetch result does not exist", { projectId, siteId, discoveredUrlId, fetchResultId });
    }
  }
}
