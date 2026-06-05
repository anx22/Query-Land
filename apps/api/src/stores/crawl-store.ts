import { randomUUID } from "node:crypto";
import { calculateHealthScore, type AuditIssueRecord, type CrawlHealthScore, type CrawlRun, type DiscoveredUrl, type IndexabilityRecord, type UrlFetchRecord } from "@seo-tool/domain-model";
import { countIssueSeverities, emptyCrawlRunSummary, mapAuditIssueRecord, mapCrawlHealthScore, mapCrawlRun, mapDiscoveredUrl, mapIndexabilityRecord, mapUrlFetchRecord } from "../sqlite-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

export interface RecordAuditIssuesScope {
  checkedDiscoveredUrlIds: string[];
}

export interface CrawlStore {
  listCrawlRuns(projectId: string, siteId: string): CrawlRun[];
  createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): CrawlRun;
  completeCrawlRun(projectId: string, siteId: string, runId: string, status: Extract<CrawlRun["status"], "succeeded" | "failed">, errorMessage?: string): CrawlRun;
  listHealthScores(projectId: string, siteId: string): CrawlHealthScore[];
  computeHealthScore(projectId: string, siteId: string): CrawlHealthScore;
  listAuditIssues(projectId: string, siteId: string): AuditIssueRecord[];
  recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[], scope: RecordAuditIssuesScope): { issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number };
  resolveAuditIssue(projectId: string, siteId: string, issueId: string): AuditIssueRecord;
  listDiscoveredUrls(projectId: string, siteId?: string): DiscoveredUrl[];
  recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): { urls: DiscoveredUrl[]; inserted: number; updated: number };
  listFetchResults(projectId: string, siteId: string, discoveredUrlId: string): UrlFetchRecord[];
  recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): UrlFetchRecord;
  listIndexabilityAssessments(projectId: string, siteId: string, discoveredUrlId: string): IndexabilityRecord[];
  recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): IndexabilityRecord;
}

export function createCrawlStore(db: SQLiteDatabase, audit: AuditLog): CrawlStore {
  return new SQLiteCrawlStore(db, audit);
}

class SQLiteCrawlStore implements CrawlStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  listCrawlRuns(projectId: string, siteId: string): CrawlRun[] {
    return this.db.prepare(`SELECT * FROM crawl_runs WHERE project_id = ? AND site_id = ? ORDER BY started_at DESC`).all(projectId, siteId).map(mapCrawlRun);
  }

  createCrawlRun(projectId: string, siteId: string, trigger: CrawlRun["trigger"]): CrawlRun {
    this.assertSiteScope(projectId, siteId);
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
    this.db.prepare(`
      INSERT INTO crawl_runs (id, project_id, site_id, status, trigger, started_at, finished_at, summary, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(run.id, projectId, siteId, run.status, run.trigger, run.startedAt, run.finishedAt, JSON.stringify(run.summary), null);
    this.audit("system", "crawl.run.create", "crawl_run", run.id, { projectId, siteId, trigger });
    return run;
  }

  completeCrawlRun(projectId: string, siteId: string, runId: string, status: Extract<CrawlRun["status"], "succeeded" | "failed">, errorMessage?: string): CrawlRun {
    const summary = this.crawlRunSummary(projectId, siteId);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE crawl_runs
      SET status = ?, finished_at = ?, summary = ?, error_message = ?
      WHERE id = ? AND project_id = ? AND site_id = ?
    `).run(status, now, JSON.stringify(summary), errorMessage ?? null, runId, projectId, siteId);
    const row = this.db.prepare(`SELECT * FROM crawl_runs WHERE id = ? AND project_id = ? AND site_id = ?`).get(runId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "crawl_run_not_found", "Crawl run not found", { projectId, siteId, runId });
    }
    this.audit("system", "crawl.run.complete", "crawl_run", runId, { projectId, siteId, status });
    return mapCrawlRun(row);
  }

  listHealthScores(projectId: string, siteId: string): CrawlHealthScore[] {
    return this.db.prepare(`SELECT * FROM crawl_health_scores WHERE project_id = ? AND site_id = ? ORDER BY generated_at DESC`).all(projectId, siteId).map(mapCrawlHealthScore);
  }

  computeHealthScore(projectId: string, siteId: string): CrawlHealthScore {
    this.assertSiteScope(projectId, siteId);
    const openIssues = this.listAuditIssues(projectId, siteId).filter((issue) => issue.resolvedAt === null);
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
    this.db.prepare(`
      INSERT INTO crawl_health_scores (id, project_id, site_id, score, total_issues, issue_counts, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(score.id, projectId, siteId, score.score, score.totalIssues, JSON.stringify(score.issueCounts), score.generatedAt);
    this.audit("system", "crawl.health.compute", "site", siteId, { projectId, score: score.score, totalIssues: score.totalIssues });
    return score;
  }

  listAuditIssues(projectId: string, siteId: string): AuditIssueRecord[] {
    return this.db.prepare(`SELECT * FROM audit_issues WHERE project_id = ? AND site_id = ? ORDER BY detected_at DESC, severity ASC`).all(projectId, siteId).map(mapAuditIssueRecord);
  }

  recordAuditIssues(projectId: string, siteId: string, issues: AuditIssueRecord[], scope: RecordAuditIssuesScope): { issues: AuditIssueRecord[]; inserted: number; updated: number; resolved: number } {
    this.assertSiteScope(projectId, siteId);
    const checkedDiscoveredUrlIds = [...new Set(scope.checkedDiscoveredUrlIds)];
    for (const discoveredUrlId of checkedDiscoveredUrlIds) {
      this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    }

    const checkedDiscoveredUrlIdSet = new Set(checkedDiscoveredUrlIds);
    const checkedUrlRows = checkedDiscoveredUrlIds.map((discoveredUrlId) =>
      this.db.prepare(`SELECT url, normalized_url FROM discovered_urls WHERE id = ? AND project_id = ? AND site_id = ?`).get(discoveredUrlId, projectId, siteId)
    );
    const checkedUrlSet = new Set(checkedUrlRows.flatMap((row) => (row ? [String(row.url), String(row.normalized_url)] : [])));

    for (const issue of issues) {
      if (issue.projectId !== projectId || issue.siteId !== siteId) {
        throw new RequestError(400, "issue_scope_mismatch", "Audit issue projectId/siteId must match the route scope", { issueId: issue.id });
      }
      if (issue.discoveredUrlId) {
        this.assertDiscoveredUrlScope(projectId, siteId, issue.discoveredUrlId);
        if (!checkedDiscoveredUrlIdSet.has(issue.discoveredUrlId)) {
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
      const openScopedIssues = this.db.prepare(`SELECT id FROM audit_issues WHERE project_id = ? AND site_id = ? AND resolved_at IS NULL AND (discovered_url_id = ? OR url = ? OR url = ?)`);
      const staleIssueIds = [...new Set(checkedDiscoveredUrlIds.flatMap((discoveredUrlId, index) => {
        const checkedUrlRow = checkedUrlRows[index];
        return openScopedIssues.all(projectId, siteId, discoveredUrlId, String(checkedUrlRow?.url ?? ""), String(checkedUrlRow?.normalized_url ?? "")).map((row) => String(row.id));
      }))].filter((id) => !submittedIssueIds.has(id));

      if (staleIssueIds.length > 0) {
        const resolveStaleIssue = this.db.prepare(`UPDATE audit_issues SET resolved_at = ?, updated_at = ? WHERE id = ? AND project_id = ? AND site_id = ? AND resolved_at IS NULL`);
        for (const issueId of staleIssueIds) {
          const result = resolveStaleIssue.run(now, now, issueId, projectId, siteId);
          resolved += Number(result.changes ?? 0);
        }
      }
    }

    for (const issue of issues) {
      const existing = this.db.prepare(`SELECT id FROM audit_issues WHERE id = ?`).get(issue.id);
      this.db.prepare(`
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
      existing ? updated += 1 : inserted += 1;
    }
    const stored = this.listAuditIssues(projectId, siteId);
    this.audit("system", "crawl.issues.record", "site", siteId, { projectId, checkedDiscoveredUrlIds, inserted, updated, resolved, total: stored.length });
    return { issues: stored, inserted, updated, resolved };
  }

  resolveAuditIssue(projectId: string, siteId: string, issueId: string): AuditIssueRecord {
    this.assertSiteScope(projectId, siteId);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE audit_issues
      SET resolved_at = COALESCE(resolved_at, ?), updated_at = ?
      WHERE id = ? AND project_id = ? AND site_id = ?
    `).run(now, now, issueId, projectId, siteId);
    const row = this.db.prepare(`SELECT * FROM audit_issues WHERE id = ? AND project_id = ? AND site_id = ?`).get(issueId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "audit_issue_not_found", "Audit issue not found", { projectId, siteId, issueId });
    }
    this.audit("system", "crawl.issue.resolve", "audit_issue", issueId, { projectId, siteId });
    return mapAuditIssueRecord(row);
  }

  listDiscoveredUrls(projectId: string, siteId?: string): DiscoveredUrl[] {
    const sql = siteId
      ? `SELECT * FROM discovered_urls WHERE project_id = ? AND site_id = ? ORDER BY discovered_at ASC, normalized_url ASC`
      : `SELECT * FROM discovered_urls WHERE project_id = ? ORDER BY discovered_at ASC, normalized_url ASC`;
    const rows = siteId
      ? this.db.prepare(sql).all(projectId, siteId)
      : this.db.prepare(sql).all(projectId);
    return rows.map(mapDiscoveredUrl);
  }

  recordDiscoveredUrls(projectId: string, siteId: string, urls: DiscoveredUrl[]): { urls: DiscoveredUrl[]; inserted: number; updated: number } {
    const site = this.db.prepare(`SELECT id FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
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
      const existing = this.db.prepare(`SELECT id FROM discovered_urls WHERE project_id = ? AND site_id = ? AND normalized_url = ?`).get(projectId, siteId, url.normalizedUrl);
      this.db.prepare(`
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

    const stored = this.listDiscoveredUrls(projectId, siteId);
    this.audit("system", "crawl.discovery.record", "site", siteId, { projectId, inserted, updated, total: stored.length });
    return { urls: stored, inserted, updated };
  }

  listFetchResults(projectId: string, siteId: string, discoveredUrlId: string): UrlFetchRecord[] {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    return this.db.prepare(`
      SELECT * FROM url_fetch_results
      WHERE project_id = ? AND site_id = ? AND discovered_url_id = ?
      ORDER BY fetched_at DESC, created_at DESC
    `).all(projectId, siteId, discoveredUrlId).map(mapUrlFetchRecord);
  }

  recordFetchResult(projectId: string, siteId: string, discoveredUrlId: string, result: Omit<UrlFetchRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): UrlFetchRecord {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    const id = `fetch-${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`
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
    this.audit("system", "crawl.fetch.record", "discovered_url", discoveredUrlId, { projectId, siteId, statusClass: result.statusClass, statusCode: result.statusCode });
    const row = this.db.prepare(`SELECT * FROM url_fetch_results WHERE id = ?`).get(id);
    if (!row) {
      throw new RequestError(400, "fetch_result_write_failed", "Fetch result could not be stored");
    }
    return mapUrlFetchRecord(row);
  }

  listIndexabilityAssessments(projectId: string, siteId: string, discoveredUrlId: string): IndexabilityRecord[] {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    return this.db.prepare(`
      SELECT * FROM url_indexability_assessments
      WHERE project_id = ? AND site_id = ? AND discovered_url_id = ?
      ORDER BY assessed_at DESC, created_at DESC
    `).all(projectId, siteId, discoveredUrlId).map(mapIndexabilityRecord);
  }

  recordIndexabilityAssessment(projectId: string, siteId: string, discoveredUrlId: string, assessment: Omit<IndexabilityRecord, "id" | "projectId" | "siteId" | "discoveredUrlId">): IndexabilityRecord {
    this.assertDiscoveredUrlScope(projectId, siteId, discoveredUrlId);
    if (assessment.fetchResultId) {
      this.assertFetchResultScope(projectId, siteId, discoveredUrlId, assessment.fetchResultId);
    }
    const id = `index-${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`
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
    this.audit("system", "crawl.indexability.record", "discovered_url", discoveredUrlId, { projectId, siteId, state: assessment.state, isIndexable: assessment.isIndexable });
    const row = this.db.prepare(`SELECT * FROM url_indexability_assessments WHERE id = ?`).get(id);
    if (!row) {
      throw new RequestError(400, "indexability_write_failed", "Indexability assessment could not be stored");
    }
    return mapIndexabilityRecord(row);
  }

  private assertSiteScope(projectId: string, siteId: string): void {
    const row = this.db.prepare(`SELECT id FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!row) {
      throw new RequestError(404, "unknown_site", "Referenced site does not exist", { projectId, siteId });
    }
  }

  private crawlRunSummary(projectId: string, siteId: string): CrawlRun["summary"] {
    const discoveredUrls = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM discovered_urls WHERE project_id = ? AND site_id = ?`).get(projectId, siteId)?.count ?? 0);
    const fetchedUrls = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM url_fetch_results WHERE project_id = ? AND site_id = ?`).get(projectId, siteId)?.count ?? 0);
    const indexabilityAssessments = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM url_indexability_assessments WHERE project_id = ? AND site_id = ?`).get(projectId, siteId)?.count ?? 0);
    const openIssues = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM audit_issues WHERE project_id = ? AND site_id = ? AND resolved_at IS NULL`).get(projectId, siteId)?.count ?? 0);
    const healthRow = this.db.prepare(`SELECT score FROM crawl_health_scores WHERE project_id = ? AND site_id = ? ORDER BY generated_at DESC LIMIT 1`).get(projectId, siteId);
    return { discoveredUrls, fetchedUrls, indexabilityAssessments, openIssues, healthScore: healthRow ? Number(healthRow.score) : null };
  }

  private assertDiscoveredUrlScope(projectId: string, siteId: string, discoveredUrlId: string): void {
    const row = this.db.prepare(`SELECT id FROM discovered_urls WHERE id = ? AND project_id = ? AND site_id = ?`).get(discoveredUrlId, projectId, siteId);
    if (!row) {
      throw new RequestError(404, "unknown_discovered_url", "Referenced discovered URL does not exist", { projectId, siteId, discoveredUrlId });
    }
  }

  private assertFetchResultScope(projectId: string, siteId: string, discoveredUrlId: string, fetchResultId: string): void {
    const row = this.db.prepare(`
      SELECT id FROM url_fetch_results
      WHERE id = ? AND project_id = ? AND site_id = ? AND discovered_url_id = ?
    `).get(fetchResultId, projectId, siteId, discoveredUrlId);
    if (!row) {
      throw new RequestError(404, "unknown_fetch_result", "Referenced fetch result does not exist", { projectId, siteId, discoveredUrlId, fetchResultId });
    }
  }
}
