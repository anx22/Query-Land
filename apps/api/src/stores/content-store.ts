import { randomUUID } from "node:crypto";
import {
  CONTENT_INTENTS,
  CONTENT_RECOMMENDATION_STATUSES,
  calculateHealthScore,
  computeContentScore,
  rankRefreshCandidates,
  type ContentInternalLink,
  type ContentIntent,
  type ContentRecommendation,
  type ContentRecommendationStatus,
  type ContentScore,
  type ContentTerm,
  type PageMetric,
  type PageMetricName,
  type RefreshCandidate
} from "@seo-tool/domain-model";
import type { AuditLog } from "./audit-log.js";
import type { ProposalStore } from "./proposal-store.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export interface CreateContentRecommendationInput {
  url: string;
  opportunityId?: string | null;
  title: string;
  targetTopic?: string;
  targetQueries?: string[];
  intent?: ContentIntent;
  sections?: string[];
  terms?: ContentTerm[];
  internalLinks?: ContentInternalLink[];
  validationMetric?: string;
  notes?: string;
}

export interface UpdateContentRecommendationInput {
  title?: string;
  targetTopic?: string;
  targetQueries?: string[];
  intent?: ContentIntent;
  sections?: string[];
  terms?: ContentTerm[];
  internalLinks?: ContentInternalLink[];
  validationMetric?: string;
  notes?: string;
  opportunityId?: string | null;
}

export interface PageMetricInput {
  url: string;
  metric: PageMetricName;
  value: number;
  capturedAt: string;
  sourceConfidence?: PageMetric["sourceConfidence"];
}

export interface BriefToProposalInput {
  kind?: "dev_ticket" | "fix_pr";
  title?: string;
  body?: string;
}

export interface ContentStore {
  createContentRecommendation(projectId: string, siteId: string, input: CreateContentRecommendationInput): Promise<ContentRecommendation>;
  getContentRecommendation(recommendationId: string): Promise<ContentRecommendation>;
  listContentRecommendations(projectId: string, siteId: string, filters?: { status?: ContentRecommendationStatus }): Promise<ContentRecommendation[]>;
  updateContentRecommendation(recommendationId: string, input: UpdateContentRecommendationInput): Promise<ContentRecommendation>;
  transitionContentRecommendation(recommendationId: string, nextStatus: ContentRecommendationStatus): Promise<ContentRecommendation>;
  recordPageMetrics(projectId: string, siteId: string, metrics: PageMetricInput[]): Promise<{ inserted: number; updated: number }>;
  listPageMetrics(projectId: string, siteId: string, url?: string): Promise<PageMetric[]>;
  listRefreshCandidates(projectId: string, siteId: string, options?: { limit?: number }): Promise<RefreshCandidate[]>;
  contentScore(projectId: string, siteId: string, url: string): Promise<ContentScore>;
  suggestInternalLinks(projectId: string, siteId: string, url: string): Promise<ContentInternalLink[]>;
  createProposalFromBrief(recommendationId: string, input: BriefToProposalInput): Promise<{ proposal: unknown; recommendation: ContentRecommendation }>;
}

// Status lifecycle: draft -> ready -> in_progress -> done; dismiss from any non-terminal state,
// and a dismissed brief can be reopened to draft. Mirrors the discipline used elsewhere.
const ALLOWED_TRANSITIONS: Record<ContentRecommendationStatus, ContentRecommendationStatus[]> = {
  draft: ["ready", "dismissed"],
  ready: ["in_progress", "draft", "dismissed"],
  in_progress: ["done", "ready", "dismissed"],
  done: ["dismissed"],
  dismissed: ["draft"]
};

export function createContentStore(db: AsyncDatabase, audit: AuditLog, proposals: ProposalStore): ContentStore {
  return new SQLiteContentStore(db, audit, proposals);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RequestError(400, "missing_field", `${field} is required`);
  }
  return value.trim();
}

function asStringArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new RequestError(400, "invalid_field", "expected an array of strings");
  return value.map((item) => String(item));
}

function asTerms(value: unknown): ContentTerm[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new RequestError(400, "invalid_field", "terms must be an array");
  return value.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    return { term: requireString(record.term, "term.term"), done: Boolean(record.done) };
  });
}

function asInternalLinks(value: unknown): ContentInternalLink[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new RequestError(400, "invalid_field", "internalLinks must be an array");
  return value.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    return {
      url: requireString(record.url, "internalLinks.url"),
      anchor: record.anchor === null || record.anchor === undefined ? null : String(record.anchor),
      reason: typeof record.reason === "string" ? record.reason : ""
    };
  });
}

function normalizeIntent(value: unknown): ContentIntent {
  if (value === undefined || value === null) return "informational";
  if (typeof value !== "string" || !CONTENT_INTENTS.includes(value as ContentIntent)) {
    throw new RequestError(400, "invalid_field", `intent must be one of ${CONTENT_INTENTS.join(", ")}`);
  }
  return value as ContentIntent;
}

class SQLiteContentStore implements ContentStore {
  constructor(
    private readonly db: AsyncDatabase,
    private readonly audit: AuditLog,
    private readonly proposals: ProposalStore
  ) {}

  private async assertSiteScope(projectId: string, siteId: string): Promise<void> {
    const row = await this.db.prepare(`SELECT 1 FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId);
    if (!row) {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
  }

  async createContentRecommendation(projectId: string, siteId: string, input: CreateContentRecommendationInput): Promise<ContentRecommendation> {
    await this.assertSiteScope(projectId, siteId);
    const url = requireString(input.url, "url");
    const title = requireString(input.title, "title");
    const opportunityId = input.opportunityId ?? null;
    if (opportunityId && !(await this.db.prepare(`SELECT 1 FROM opportunities WHERE id = ? AND project_id = ?`).get(opportunityId, projectId))) {
      throw new RequestError(404, "unknown_opportunity", "Opportunity not found for project");
    }

    const now = new Date().toISOString();
    const recommendation: ContentRecommendation = {
      id: `crec-${randomUUID()}`,
      projectId,
      siteId,
      url,
      opportunityId,
      title,
      targetTopic: typeof input.targetTopic === "string" ? input.targetTopic.trim() : "",
      targetQueries: asStringArray(input.targetQueries),
      intent: normalizeIntent(input.intent),
      sections: asStringArray(input.sections),
      terms: asTerms(input.terms),
      internalLinks: asInternalLinks(input.internalLinks),
      validationMetric: typeof input.validationMetric === "string" ? input.validationMetric.trim() : "",
      status: "draft",
      notes: typeof input.notes === "string" ? input.notes : "",
      createdAt: now,
      updatedAt: now
    };

    await this.db.prepare(`INSERT INTO content_recommendations (id, project_id, site_id, url, opportunity_id, title, target_topic, target_queries, intent, sections, terms, internal_links, validation_metric, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      recommendation.id,
      recommendation.projectId,
      recommendation.siteId,
      recommendation.url,
      recommendation.opportunityId,
      recommendation.title,
      recommendation.targetTopic,
      JSON.stringify(recommendation.targetQueries),
      recommendation.intent,
      JSON.stringify(recommendation.sections),
      JSON.stringify(recommendation.terms),
      JSON.stringify(recommendation.internalLinks),
      recommendation.validationMetric,
      recommendation.status,
      recommendation.notes,
      recommendation.createdAt,
      recommendation.updatedAt
    );
    await this.audit("system", "content_recommendation.create", "content_recommendation", recommendation.id, { projectId, siteId, url });
    return recommendation;
  }

  async getContentRecommendation(recommendationId: string): Promise<ContentRecommendation> {
    const row = await this.db.prepare(`SELECT * FROM content_recommendations WHERE id = ?`).get(recommendationId);
    if (!row) {
      throw new RequestError(404, "unknown_content_recommendation", "Content recommendation not found");
    }
    return this.mapRecommendation(row as Record<string, unknown>);
  }

  async listContentRecommendations(projectId: string, siteId: string, filters: { status?: ContentRecommendationStatus } = {}): Promise<ContentRecommendation[]> {
    await this.assertSiteScope(projectId, siteId);
    const clauses = ["project_id = ?", "site_id = ?"];
    const args: unknown[] = [projectId, siteId];
    if (filters.status) {
      clauses.push("status = ?");
      args.push(filters.status);
    }
    const rows = await this.db.prepare(`SELECT * FROM content_recommendations WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id DESC`).all(...args);
    return rows.map((row) => this.mapRecommendation(row as Record<string, unknown>));
  }

  async updateContentRecommendation(recommendationId: string, input: UpdateContentRecommendationInput): Promise<ContentRecommendation> {
    const current = await this.getContentRecommendation(recommendationId);
    if (current.status === "dismissed" || current.status === "done") {
      throw new RequestError(409, "invalid_state", `Cannot edit a ${current.status} content recommendation`);
    }

    let opportunityId = current.opportunityId;
    if (input.opportunityId !== undefined) {
      opportunityId = input.opportunityId;
      if (opportunityId && !(await this.db.prepare(`SELECT 1 FROM opportunities WHERE id = ? AND project_id = ?`).get(opportunityId, current.projectId))) {
        throw new RequestError(404, "unknown_opportunity", "Opportunity not found for project");
      }
    }

    const next: ContentRecommendation = {
      ...current,
      title: input.title !== undefined ? requireString(input.title, "title") : current.title,
      targetTopic: input.targetTopic !== undefined ? input.targetTopic.trim() : current.targetTopic,
      targetQueries: input.targetQueries !== undefined ? asStringArray(input.targetQueries) : current.targetQueries,
      intent: input.intent !== undefined ? normalizeIntent(input.intent) : current.intent,
      sections: input.sections !== undefined ? asStringArray(input.sections) : current.sections,
      terms: input.terms !== undefined ? asTerms(input.terms) : current.terms,
      internalLinks: input.internalLinks !== undefined ? asInternalLinks(input.internalLinks) : current.internalLinks,
      validationMetric: input.validationMetric !== undefined ? input.validationMetric.trim() : current.validationMetric,
      notes: input.notes !== undefined ? input.notes : current.notes,
      opportunityId,
      updatedAt: new Date().toISOString()
    };

    await this.db.prepare(`UPDATE content_recommendations SET title = ?, target_topic = ?, target_queries = ?, intent = ?, sections = ?, terms = ?, internal_links = ?, validation_metric = ?, notes = ?, opportunity_id = ?, updated_at = ? WHERE id = ?`).run(
      next.title,
      next.targetTopic,
      JSON.stringify(next.targetQueries),
      next.intent,
      JSON.stringify(next.sections),
      JSON.stringify(next.terms),
      JSON.stringify(next.internalLinks),
      next.validationMetric,
      next.notes,
      next.opportunityId,
      next.updatedAt,
      recommendationId
    );
    await this.audit("system", "content_recommendation.update", "content_recommendation", recommendationId, {});
    return next;
  }

  async transitionContentRecommendation(recommendationId: string, nextStatus: ContentRecommendationStatus): Promise<ContentRecommendation> {
    if (!CONTENT_RECOMMENDATION_STATUSES.includes(nextStatus)) {
      throw new RequestError(400, "invalid_field", `status must be one of ${CONTENT_RECOMMENDATION_STATUSES.join(", ")}`);
    }
    const current = await this.getContentRecommendation(recommendationId);
    if (current.status === nextStatus) {
      throw new RequestError(409, "invalid_transition", `Content recommendation is already ${current.status}`);
    }
    if (!ALLOWED_TRANSITIONS[current.status].includes(nextStatus)) {
      throw new RequestError(409, "invalid_transition", `Cannot transition from ${current.status} to ${nextStatus}`);
    }
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE content_recommendations SET status = ?, updated_at = ? WHERE id = ?`).run(nextStatus, now, recommendationId);
    await this.audit("system", "content_recommendation.transition", "content_recommendation", recommendationId, { from: current.status, to: nextStatus });
    return { ...current, status: nextStatus, updatedAt: now };
  }

  async recordPageMetrics(projectId: string, siteId: string, metrics: PageMetricInput[]): Promise<{ inserted: number; updated: number }> {
    await this.assertSiteScope(projectId, siteId);
    if (!Array.isArray(metrics) || metrics.length === 0) {
      throw new RequestError(400, "missing_field", "metrics is required and must be a non-empty array");
    }
    let inserted = 0;
    let updated = 0;
    await this.db.transaction(async (tx) => {
      const existing = tx.prepare(`SELECT id FROM page_metrics WHERE project_id = ? AND site_id = ? AND url = ? AND metric = ? AND captured_at = ?`);
      const insert = tx.prepare(`INSERT INTO page_metrics (id, project_id, site_id, url, metric, value, captured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      const update = tx.prepare(`UPDATE page_metrics SET value = ?, source_confidence = ? WHERE id = ?`);
      for (const metric of metrics) {
        const url = requireString(metric.url, "metric.url");
        if (typeof metric.value !== "number" || Number.isNaN(metric.value)) {
          throw new RequestError(400, "invalid_field", "metric.value must be a number");
        }
        const capturedAt = requireString(metric.capturedAt, "metric.capturedAt");
        const sourceConfidence = metric.sourceConfidence ?? "E";
        const found = await existing.get(projectId, siteId, url, metric.metric, capturedAt) as { id: string } | undefined;
        if (found) {
          await update.run(metric.value, sourceConfidence, found.id);
          updated += 1;
        } else {
          await insert.run(`pm-${randomUUID()}`, projectId, siteId, url, metric.metric, metric.value, capturedAt, sourceConfidence);
          inserted += 1;
        }
      }
    });
    await this.audit("system", "page_metrics.record", "site", siteId, { projectId, inserted, updated });
    return { inserted, updated };
  }

  async listPageMetrics(projectId: string, siteId: string, url?: string): Promise<PageMetric[]> {
    await this.assertSiteScope(projectId, siteId);
    const clauses = ["project_id = ?", "site_id = ?"];
    const args: unknown[] = [projectId, siteId];
    if (url) {
      clauses.push("url = ?");
      args.push(url);
    }
    const rows = await this.db.prepare(`SELECT * FROM page_metrics WHERE ${clauses.join(" AND ")} ORDER BY url ASC, metric ASC, captured_at ASC`).all(...args);
    return rows.map((row) => this.mapPageMetric(row as Record<string, unknown>));
  }

  async listRefreshCandidates(projectId: string, siteId: string, options: { limit?: number } = {}): Promise<RefreshCandidate[]> {
    await this.assertSiteScope(projectId, siteId);
    // Decay is derived deterministically from the clicks time-series: trend = latest - earliest.
    const rows = await this.db.prepare(`SELECT url, value, captured_at FROM page_metrics WHERE project_id = ? AND site_id = ? AND metric = 'clicks' ORDER BY url ASC, captured_at ASC`).all(projectId, siteId) as Array<{ url: string; value: number; captured_at: string }>;
    const series = new Map<string, Array<{ value: number; capturedAt: string }>>();
    for (const row of rows) {
      const list = series.get(String(row.url)) ?? [];
      list.push({ value: Number(row.value), capturedAt: String(row.captured_at) });
      series.set(String(row.url), list);
    }

    const inputs = [] as Array<{ url: string; clicksTrend: number; latestClicks: number; openIssues: number }>;
    for (const [url, points] of series) {
      if (points.length < 2) continue;
      const earliest = points[0].value;
      const latest = points[points.length - 1].value;
      const openIssues = await this.openIssuesForUrl(projectId, siteId, url);
      inputs.push({ url, clicksTrend: Math.round(latest - earliest), latestClicks: latest, openIssues });
    }
    return rankRefreshCandidates(inputs, options);
  }

  async contentScore(projectId: string, siteId: string, url: string): Promise<ContentScore> {
    await this.assertSiteScope(projectId, siteId);
    requireString(url, "url");

    // Health: latest computed crawl health score, else a deterministic fallback from open issues.
    const healthRow = await this.db.prepare(`SELECT score FROM crawl_health_scores WHERE project_id = ? AND site_id = ? ORDER BY generated_at DESC LIMIT 1`).get(projectId, siteId) as { score?: number } | undefined;
    const openIssues = await this.openIssuesForUrl(projectId, siteId, url);
    let healthScore: number;
    if (healthRow && typeof healthRow.score === "number") {
      healthScore = Number(healthRow.score);
    } else {
      // Fallback: derive a deterministic health proxy from this URL's open issues' severities.
      const severityRows = await this.db.prepare(`SELECT severity FROM audit_issues WHERE project_id = ? AND site_id = ? AND url = ? AND resolved_at IS NULL AND dismissed_at IS NULL`).all(projectId, siteId, url) as Array<{ severity: string }>;
      healthScore = calculateHealthScore(severityRows.map((row) => ({ severity: row.severity as never })));
    }

    const metricTrend = await this.clicksTrendForUrl(projectId, siteId, url);
    const { score, reasons } = computeContentScore(healthScore, openIssues, metricTrend);
    return { url, score, healthScore, openIssues, metricTrend, reasons };
  }

  async suggestInternalLinks(projectId: string, siteId: string, url: string): Promise<ContentInternalLink[]> {
    await this.assertSiteScope(projectId, siteId);
    requireString(url, "url");
    const suggestions = new Map<string, ContentInternalLink>();

    // 1) Sibling pages: pages that share an inbound source (hub) with the target but do NOT yet
    //    link to it. The shared hub is a natural place to add an internal link.
    const sources = await this.db.prepare(`SELECT DISTINCT from_url FROM internal_link_edges WHERE site_id = ? AND to_url = ?`).all(siteId, url) as Array<{ from_url: string }>;
    for (const source of sources) {
      const siblings = await this.db.prepare(`SELECT DISTINCT to_url FROM internal_link_edges WHERE site_id = ? AND from_url = ? AND to_url <> ?`).all(siteId, source.from_url, url) as Array<{ to_url: string }>;
      for (const sibling of siblings) {
        const target = String(sibling.to_url);
        if (target === url || suggestions.has(target)) continue;
        // Suggest linking the target to a sibling that the shared hub already links to.
        if (!(await this.edgeExists(siteId, url, target))) {
          suggestions.set(target, { url: target, anchor: null, reason: `Gemeinsam verlinkt vom Hub ${source.from_url}` });
        }
      }
    }

    // 2) Hubs that link to the target's siblings but not to the target itself (inbound link gaps).
    const outTargets = await this.db.prepare(`SELECT DISTINCT to_url FROM internal_link_edges WHERE site_id = ? AND from_url = ?`).all(siteId, url) as Array<{ to_url: string }>;
    for (const out of outTargets) {
      const hubs = await this.db.prepare(`SELECT DISTINCT from_url, anchor FROM internal_link_edges WHERE site_id = ? AND to_url = ? AND from_url <> ?`).all(siteId, String(out.to_url), url) as Array<{ from_url: string; anchor: string | null }>;
      for (const hub of hubs) {
        const candidate = String(hub.from_url);
        if (candidate === url || suggestions.has(candidate)) continue;
        if (!(await this.edgeExists(siteId, candidate, url))) {
          suggestions.set(candidate, { url: candidate, anchor: hub.anchor === null ? null : String(hub.anchor), reason: `Verlinkt eine verwandte Seite (${String(out.to_url)}), aber nicht diese URL` });
        }
      }
    }

    return [...suggestions.values()].sort((left, right) => left.url.localeCompare(right.url)).slice(0, 20);
  }

  async createProposalFromBrief(recommendationId: string, input: BriefToProposalInput): Promise<{ proposal: unknown; recommendation: ContentRecommendation }> {
    const recommendation = await this.getContentRecommendation(recommendationId);
    const kind = input.kind ?? "dev_ticket";
    if (kind !== "dev_ticket" && kind !== "fix_pr") {
      throw new RequestError(400, "invalid_field", "kind must be dev_ticket or fix_pr");
    }
    const title = input.title && input.title.trim() !== "" ? input.title.trim() : `Content refresh: ${recommendation.title}`;
    const body = input.body && input.body.trim() !== "" ? input.body.trim() : this.briefToBody(recommendation);

    const proposal = await this.proposals.createProposal(recommendation.projectId, {
      kind,
      title,
      body,
      opportunityId: recommendation.opportunityId,
      source: "content_workspace"
    });
    await this.audit("system", "content_recommendation.proposal", "content_recommendation", recommendationId, { kind });
    return { proposal, recommendation };
  }

  private briefToBody(recommendation: ContentRecommendation): string {
    const lines: string[] = [];
    lines.push(`URL: ${recommendation.url}`);
    lines.push(`Topic: ${recommendation.targetTopic || "(none)"}`);
    lines.push(`Intent: ${recommendation.intent}`);
    if (recommendation.targetQueries.length > 0) lines.push(`Target queries: ${recommendation.targetQueries.join(", ")}`);
    if (recommendation.sections.length > 0) lines.push(`Sections:\n- ${recommendation.sections.join("\n- ")}`);
    if (recommendation.terms.length > 0) lines.push(`Terms: ${recommendation.terms.map((term) => term.term).join(", ")}`);
    if (recommendation.internalLinks.length > 0) lines.push(`Internal links:\n- ${recommendation.internalLinks.map((link) => link.url).join("\n- ")}`);
    if (recommendation.validationMetric) lines.push(`Validation metric: ${recommendation.validationMetric}`);
    if (recommendation.notes) lines.push(`Notes: ${recommendation.notes}`);
    return lines.join("\n");
  }

  private async edgeExists(siteId: string, fromUrl: string, toUrl: string): Promise<boolean> {
    return !!(await this.db.prepare(`SELECT 1 FROM internal_link_edges WHERE site_id = ? AND from_url = ? AND to_url = ?`).get(siteId, fromUrl, toUrl));
  }

  private async openIssuesForUrl(projectId: string, siteId: string, url: string): Promise<number> {
    const row = await this.db.prepare(`SELECT COUNT(*) AS c FROM audit_issues WHERE project_id = ? AND site_id = ? AND url = ? AND resolved_at IS NULL AND dismissed_at IS NULL`).get(projectId, siteId, url) as { c: number };
    return Number(row.c);
  }

  private async clicksTrendForUrl(projectId: string, siteId: string, url: string): Promise<number> {
    const rows = await this.db.prepare(`SELECT value FROM page_metrics WHERE project_id = ? AND site_id = ? AND url = ? AND metric = 'clicks' ORDER BY captured_at ASC`).all(projectId, siteId, url) as Array<{ value: number }>;
    if (rows.length < 2) return 0;
    return Math.round(Number(rows[rows.length - 1].value) - Number(rows[0].value));
  }

  private mapRecommendation(row: Record<string, unknown>): ContentRecommendation {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      siteId: String(row.site_id),
      url: String(row.url),
      opportunityId: row.opportunity_id === null || row.opportunity_id === undefined ? null : String(row.opportunity_id),
      title: String(row.title),
      targetTopic: String(row.target_topic ?? ""),
      targetQueries: JSON.parse(String(row.target_queries ?? "[]")) as string[],
      intent: String(row.intent) as ContentIntent,
      sections: JSON.parse(String(row.sections ?? "[]")) as string[],
      terms: JSON.parse(String(row.terms ?? "[]")) as ContentTerm[],
      internalLinks: JSON.parse(String(row.internal_links ?? "[]")) as ContentInternalLink[],
      validationMetric: String(row.validation_metric ?? ""),
      status: String(row.status) as ContentRecommendationStatus,
      notes: String(row.notes ?? ""),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  private mapPageMetric(row: Record<string, unknown>): PageMetric {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      siteId: String(row.site_id),
      url: String(row.url),
      metric: String(row.metric) as PageMetricName,
      value: Number(row.value),
      capturedAt: String(row.captured_at),
      sourceConfidence: String(row.source_confidence) as PageMetric["sourceConfidence"]
    };
  }
}
