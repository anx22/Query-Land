import { randomUUID } from "node:crypto";
import { analyzeCannibalization, analyzeCtrGap, analyzeStrikingDistance, hasRequiredEvidence, OPPORTUNITY_STATUS_TRANSITIONS, scoreOpportunity, type Evidence, type Opportunity, type OpportunityStatus, type SearchPerformanceMetricRow, type SourceAnchor } from "@seo-tool/domain-model";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export type OpportunityType = Opportunity["type"];

/** Compare two URLs ignoring a trailing slash (GSC page URLs vs crawl URLs differ only there). */
function sameUrl(a: string, b: string): boolean {
  const strip = (u: string) => u.replace(/\/+$/, "");
  return strip(a) === strip(b);
}

export interface CreateOpportunityInput {
  type: OpportunityType;
  affectedUrls?: string[];
  affectedKeywords?: string[];
  affectedClusters?: string[];
  sourceAnchor?: SourceAnchor | null;
  currentState: string;
  recommendedAction: string;
  expectedImpact: number;
  effort: number;
  confidence: number;
  businessValue: number;
  urgency: number;
  validationMetric: string;
  owner?: string;
  evidence: Evidence[];
  expiresAt?: string;
}

export interface OpportunityListFilters {
  status?: OpportunityStatus;
  type?: OpportunityType;
}

export interface OpportunityPage {
  data: Opportunity[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface GenerateOpportunitiesResult {
  created: number;
  opportunities: Opportunity[];
}

export interface OpportunityStore {
  createOpportunity(projectId: string, input: CreateOpportunityInput): Promise<Opportunity>;
  listOpportunitiesPage(projectId: string, options?: { limit?: number; offset?: number }, filters?: OpportunityListFilters): Promise<OpportunityPage>;
  getOpportunity(opportunityId: string): Promise<Opportunity>;
  transitionOpportunity(opportunityId: string, nextStatus: OpportunityStatus): Promise<Opportunity>;
  // §6.6 erster Generator + §6.5 Validierungsloop (binär: Indexierbarkeit).
  generateIndexabilityOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult>;
  revalidateOpportunity(opportunityId: string): Promise<Opportunity>;
  // WP-3.2: weitere Opportunity-Klassen (§6.1). Aus Search-Performance: low_hanging_keyword,
  // money_page, cannibalization. Aus dem Linkgraph: internal_link_gap.
  generateSearchOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult>;
  generateInternalLinkOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult>;
  // WP-6.2: AEO-Klasse aus content-basierten Assessments (Klasse A; LLM-Signale sind Klasse E und NIE Evidenz).
  generateAeoOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult>;
  // Umbrella: alle harten Klassen in einem Lauf, idempotent.
  generateAllOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult>;
}

// Statusmodell §6.5 — single source of truth lives in @seo-tool/domain-model so the web UI offers
// exactly the transitions the store enforces.
const ALLOWED_TRANSITIONS = OPPORTUNITY_STATUS_TRANSITIONS;

const OPPORTUNITY_TYPES: readonly OpportunityType[] = ["technical_fix", "low_hanging_keyword", "cannibalization", "money_page", "internal_link_gap", "aeo"];
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export function createOpportunityStore(db: AsyncDatabase, audit: AuditLog): OpportunityStore {
  return new SQLiteOpportunityStore(db, audit);
}

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function normalizeOffset(offset?: number): number {
  if (!offset || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseReasons(raw: unknown): string {
  try {
    const reasons = JSON.parse(String(raw)) as unknown;
    return Array.isArray(reasons) ? reasons.join(", ") : "";
  } catch {
    return "";
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RequestError(400, "missing_field", `${field} is required`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new RequestError(400, "invalid_field", `${field} must be a number`);
  }
  return value;
}

class SQLiteOpportunityStore implements OpportunityStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  async createOpportunity(projectId: string, input: CreateOpportunityInput): Promise<Opportunity> {
    const project = await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId);
    if (!project) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    if (!OPPORTUNITY_TYPES.includes(input.type)) {
      throw new RequestError(400, "invalid_field", `type must be one of ${OPPORTUNITY_TYPES.join(", ")}`);
    }
    requireString(input.currentState, "currentState");
    requireString(input.recommendedAction, "recommendedAction");
    requireString(input.validationMetric, "validationMetric");

    const evidence = Array.isArray(input.evidence) ? input.evidence : [];
    if (evidence.length === 0) {
      throw new RequestError(400, "evidence_required", "at least one evidence item is required");
    }
    for (const item of evidence) {
      requireString(item.source, "evidence.source");
      requireString(item.metric, "evidence.metric");
    }
    // §2.3 / §6.3: mindestens eine Evidenz der Klasse A–C.
    if (!hasRequiredEvidence({ evidence })) {
      throw new RequestError(400, "evidence_confidence_too_low", "at least one evidence item of confidence class A, B or C is required");
    }

    const expectedImpact = requireNumber(input.expectedImpact, "expectedImpact");
    const effort = requireNumber(input.effort, "effort");
    const confidence = requireNumber(input.confidence, "confidence");
    const businessValue = requireNumber(input.businessValue, "businessValue");
    const urgency = requireNumber(input.urgency, "urgency");
    // §6.4 Prioritaetsformel (wirft DomainValidationError bei effort <= 0 -> 400 via withDomainValidation).
    const priority = scoreOpportunity({ expectedImpact, confidence, businessValue, urgency, effort });

    const now = new Date().toISOString();
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const id = `opp-${randomUUID()}`;
    const opportunity: Opportunity = {
      id,
      projectId,
      type: input.type,
      affectedUrls: input.affectedUrls ?? [],
      affectedKeywords: input.affectedKeywords ?? [],
      affectedClusters: input.affectedClusters ?? [],
      sourceAnchor: input.sourceAnchor ?? undefined,
      evidence,
      currentState: input.currentState,
      recommendedAction: input.recommendedAction,
      expectedImpact,
      effort,
      confidence,
      businessValue,
      urgency,
      priority,
      validationMetric: input.validationMetric,
      owner: input.owner ?? "system",
      status: "open",
      createdAt: now,
      updatedAt: now,
      expiresAt
    };

    await this.db.transaction(async (tx) => {
      await tx.prepare(`INSERT INTO opportunities (id, project_id, type, affected_urls, affected_keywords, affected_clusters, source_anchor, current_state, recommended_action, expected_impact, effort, confidence, business_value, urgency, priority, validation_metric, owner, status, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        opportunity.id,
        opportunity.projectId,
        opportunity.type,
        JSON.stringify(opportunity.affectedUrls),
        JSON.stringify(opportunity.affectedKeywords),
        JSON.stringify(opportunity.affectedClusters),
        opportunity.sourceAnchor ? JSON.stringify(opportunity.sourceAnchor) : null,
        opportunity.currentState,
        opportunity.recommendedAction,
        opportunity.expectedImpact,
        opportunity.effort,
        opportunity.confidence,
        opportunity.businessValue,
        opportunity.urgency,
        opportunity.priority,
        opportunity.validationMetric,
        opportunity.owner,
        opportunity.status,
        opportunity.createdAt,
        opportunity.updatedAt,
        opportunity.expiresAt
      );
      const insertEvidence = tx.prepare(`INSERT INTO opportunity_evidence (id, opportunity_id, source, source_confidence, metric, before_value, current_value, time_window, affected_entity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const item of evidence) {
        await insertEvidence.run(`ev-${randomUUID()}`, id, item.source, item.sourceConfidence, item.metric, JSON.stringify(item.beforeValue), JSON.stringify(item.currentValue), item.timeWindow, item.affectedEntity);
      }
    });

    await this.audit("system", "opportunity.create", "opportunity", id, { projectId, type: opportunity.type, priority: opportunity.priority });
    return opportunity;
  }

  async listOpportunitiesPage(projectId: string, options: { limit?: number; offset?: number } = {}, filters: OpportunityListFilters = {}): Promise<OpportunityPage> {
    const limit = normalizeLimit(options.limit);
    const offset = normalizeOffset(options.offset);
    const clauses = ["project_id = ?"];
    const args: unknown[] = [projectId];
    if (filters.status) {
      clauses.push("status = ?");
      args.push(filters.status);
    }
    if (filters.type) {
      clauses.push("type = ?");
      args.push(filters.type);
    }
    const where = clauses.join(" AND ");

    const total = Number((await this.db.prepare(`SELECT COUNT(*) AS c FROM opportunities WHERE ${where}`).get(...args) as { c: number }).c);
    const rows = await this.db.prepare(`SELECT * FROM opportunities WHERE ${where} ORDER BY priority DESC, created_at ASC LIMIT ? OFFSET ?`).all(...args, limit, offset);
    const data = await Promise.all(rows.map((row) => this.assembleOpportunity(row)));
    const nextOffset = offset + data.length;
    const nextCursor = nextOffset < total ? Buffer.from(`offset:${nextOffset}`, "utf8").toString("base64url") : null;
    return { data, limit, offset, total, nextCursor };
  }

  async getOpportunity(opportunityId: string): Promise<Opportunity> {
    const row = await this.db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(opportunityId);
    if (!row) {
      throw new RequestError(404, "unknown_opportunity", "Opportunity not found");
    }
    return this.assembleOpportunity(row);
  }

  async transitionOpportunity(opportunityId: string, nextStatus: OpportunityStatus): Promise<Opportunity> {
    const row = await this.db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(opportunityId);
    if (!row) {
      throw new RequestError(404, "unknown_opportunity", "Opportunity not found");
    }
    const current = String(row.status) as OpportunityStatus;
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (current === nextStatus) {
      throw new RequestError(409, "invalid_transition", `Opportunity is already ${current}`);
    }
    if (!allowed.includes(nextStatus)) {
      throw new RequestError(409, "invalid_transition", `Cannot transition from ${current} to ${nextStatus}`);
    }
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE opportunities SET status = ?, updated_at = ? WHERE id = ?`).run(nextStatus, now, opportunityId);
    await this.audit("system", "opportunity.transition", "opportunity", opportunityId, { from: current, to: nextStatus });
    return this.assembleOpportunity(await this.db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(opportunityId) as Record<string, unknown>);
  }

  async generateIndexabilityOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult> {
    const site = await this.db.prepare(`SELECT business_value FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId) as { business_value?: number } | undefined;
    if (!site) {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
    const businessValue = typeof site.business_value === "number" ? site.business_value : 50;

    // Neueste Indexability-Bewertung je URL; nur Blocker (is_indexable = 0).
    const blocked = await this.db.prepare(`
      SELECT du.url AS url, a.reasons AS reasons, a.state AS state
      FROM discovered_urls du
      JOIN url_indexability_assessments a ON a.id = (
        SELECT x.id FROM url_indexability_assessments x WHERE x.discovered_url_id = du.id ORDER BY x.assessed_at DESC, x.id DESC LIMIT 1
      )
      WHERE du.site_id = ? AND a.is_indexable = 0
    `).all(siteId) as Array<{ url: string; reasons: string; state: string }>;

    // Bereits abgedeckte URLs aus aktiven technical_fix-Opportunities (Dedupe).
    const activeRows = await this.db.prepare(`SELECT affected_urls FROM opportunities WHERE project_id = ? AND type = 'technical_fix' AND status NOT IN ('dismissed', 'expired', 'validated')`).all(projectId);
    const covered = new Set<string>();
    for (const row of activeRows) {
      for (const url of JSON.parse(String((row as { affected_urls: string }).affected_urls)) as string[]) {
        covered.add(url);
      }
    }

    const now = new Date().toISOString();
    const created: Opportunity[] = [];
    for (const row of blocked) {
      if (covered.has(row.url)) continue;
      const reasons = parseReasons(row.reasons);
      const opportunity = await this.createOpportunity(projectId, {
        type: "technical_fix",
        affectedUrls: [row.url],
        currentState: `not indexable (${row.state})${reasons ? `: ${reasons}` : ""}`,
        recommendedAction: "Resolve the indexability blocker in the responsible template and re-crawl",
        expectedImpact: 3,
        effort: 2,
        confidence: 0.7,
        businessValue,
        urgency: 3,
        validationMetric: "indexable",
        evidence: [{ source: "crawl", sourceConfidence: "A", metric: "indexable", beforeValue: "false", currentValue: "false", timeWindow: now, affectedEntity: row.url }]
      });
      covered.add(row.url);
      created.push(opportunity);
    }
    return { created: created.length, opportunities: created };
  }

  /**
   * Async validation loop (§6.5/§2.10): re-measure an implemented opportunity's validation metric
   * from the LATEST first-party evidence and flip it to `validated` or `reopened`. Generalized over
   * all six opportunity classes by re-running the SAME analyzer/threshold that generated it, so the
   * verdict is correct-by-construction. When no fresh evidence exists yet (e.g. GSC latency, no new
   * crawl), the opportunity stays `implemented` and the scheduled re-check simply retries next cycle.
   */
  async revalidateOpportunity(opportunityId: string): Promise<Opportunity> {
    const opportunity = await this.getOpportunity(opportunityId);
    if (opportunity.status !== "implemented") {
      throw new RequestError(409, "invalid_state", "Opportunity must be 'implemented' before it can be revalidated");
    }
    const outcome = await this.measureRevalidation(opportunity);
    if (outcome === "pending") {
      // No fresh evidence to judge yet — keep it implemented; the scheduled job re-checks later.
      return opportunity;
    }
    return this.transitionOpportunity(opportunityId, outcome);
  }

  /** Re-measure the opportunity's validation metric → "validated" | "reopened" | "pending". */
  private async measureRevalidation(o: Opportunity): Promise<"validated" | "reopened" | "pending"> {
    const url = o.affectedUrls[0] ?? null;
    const keyword = o.affectedKeywords[0] ?? null;
    const setEvidence = (metric: string, value: string | number) =>
      this.db.prepare(`UPDATE opportunity_evidence SET current_value = ? WHERE opportunity_id = ? AND metric = ?`).run(JSON.stringify(value), o.id, metric);

    switch (o.validationMetric) {
      case "indexable": {
        if (!url) return "pending";
        const row = await this.db.prepare(`
          SELECT a.is_indexable AS is_indexable FROM discovered_urls du
          JOIN url_indexability_assessments a ON a.discovered_url_id = du.id
          WHERE du.project_id = ? AND (du.url = ? OR du.normalized_url = ?)
          ORDER BY a.assessed_at DESC, a.id DESC LIMIT 1
        `).get(o.projectId, url, url) as { is_indexable?: number } | undefined;
        if (!row) return "pending";
        const indexable = Number(row.is_indexable) === 1;
        await setEvidence("indexable", indexable ? "true" : "false");
        return indexable ? "validated" : "reopened";
      }
      case "position_top10": {
        if (!url || !keyword) return "pending";
        const row = await this.searchRowFor(o.projectId, url, keyword);
        if (!row) return "pending";
        await setEvidence("position", row.position);
        return row.position <= 10 ? "validated" : "reopened";
      }
      case "ctr": {
        if (!url || !keyword) return "pending";
        const rows = await this.searchRowsForUrl(o.projectId, url);
        if (rows.length === 0) return "pending";
        const stillGap = analyzeCtrGap(rows).some((item) => item.query === keyword && sameUrl(item.pageUrl, url));
        const row = rows.find((r) => r.query === keyword && sameUrl(r.pageUrl, url));
        if (row) await setEvidence("ctr", row.ctr);
        return stillGap ? "reopened" : "validated";
      }
      case "single_dominant_page": {
        if (!keyword) return "pending";
        const rows = await this.searchRowsForUrl(o.projectId, url ?? "");
        if (rows.length === 0) return "pending";
        const stillCannibalized = analyzeCannibalization(rows).some((item) => item.query === keyword);
        await setEvidence("single_dominant_page", stillCannibalized ? "false" : "true");
        return stillCannibalized ? "reopened" : "validated";
      }
      case "inlink_count": {
        if (!url) return "pending";
        const count = Number((await this.db.prepare(`
          SELECT COUNT(*) AS c FROM internal_link_edges e
          JOIN sites s ON s.id = e.site_id
          WHERE s.project_id = ? AND e.to_url = ?
        `).get(o.projectId, url) as { c: number }).c);
        await setEvidence("inlink_count", count);
        return count > 0 ? "validated" : "reopened";
      }
      case "aeo_score": {
        if (!url) return "pending";
        const row = await this.db.prepare(`
          SELECT score FROM aeo_assessments WHERE project_id = ? AND url = ? ORDER BY assessed_at DESC, id DESC LIMIT 1
        `).get(o.projectId, url) as { score?: number } | undefined;
        if (!row || row.score === undefined || row.score === null) return "pending";
        await setEvidence("aeo_score", Number(row.score));
        return Number(row.score) >= 60 ? "validated" : "reopened";
      }
      default:
        return "pending";
    }
  }

  /** Resolve the site that owns a URL (crawled), else the project's first site (search-only URLs). */
  private async resolveSiteIdForUrl(projectId: string, url: string): Promise<string | null> {
    const owned = await this.db.prepare(`SELECT site_id FROM discovered_urls WHERE project_id = ? AND (url = ? OR normalized_url = ?) ORDER BY id ASC LIMIT 1`).get(projectId, url, url) as { site_id?: string } | undefined;
    if (owned?.site_id) return String(owned.site_id);
    const first = await this.db.prepare(`SELECT id FROM sites WHERE project_id = ? ORDER BY created_at ASC, id ASC LIMIT 1`).get(projectId) as { id?: string } | undefined;
    return first?.id ? String(first.id) : null;
  }

  /** Latest search rows for the site owning `url`. */
  private async searchRowsForUrl(projectId: string, url: string): Promise<SearchPerformanceMetricRow[]> {
    const siteId = await this.resolveSiteIdForUrl(projectId, url);
    if (!siteId) return [];
    return (await this.latestSearchRows(siteId)).rows;
  }

  /** Latest search row matching a (query, url) pair, or null. */
  private async searchRowFor(projectId: string, url: string, keyword: string): Promise<SearchPerformanceMetricRow | null> {
    const rows = await this.searchRowsForUrl(projectId, url);
    return rows.find((r) => r.query === keyword && sameUrl(r.pageUrl, url)) ?? null;
  }

  async generateSearchOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult> {
    const businessValue = await this.siteBusinessValue(projectId, siteId);
    const { capturedAt, rows } = await this.latestSearchRows(siteId);
    const created: Opportunity[] = [];
    if (!capturedAt || rows.length === 0) {
      return { created: 0, opportunities: [] };
    }

    // Low-Hanging Keywords (Striking Distance, Position 11–20). Dedupe je Query.
    const lowHangingCovered = await this.coveredEntities(projectId, "low_hanging_keyword", "affected_keywords");
    for (const item of analyzeStrikingDistance(rows, { limit: 10 })) {
      if (lowHangingCovered.has(item.query)) continue;
      created.push(await this.createOpportunity(projectId, {
        type: "low_hanging_keyword",
        affectedUrls: [item.pageUrl],
        affectedKeywords: [item.query],
        currentState: `ranks at position ${item.position} for "${item.query}"`,
        recommendedAction: "Optimize title, meta description and on-page content to move this query into the top 10",
        expectedImpact: clamp(Math.round(item.impressions / 1000), 1, 5),
        effort: 2,
        confidence: 0.6,
        businessValue,
        urgency: item.position <= 15 ? 3 : 2,
        validationMetric: "position_top10",
        evidence: [{ source: "gsc", sourceConfidence: "B", metric: "position", beforeValue: item.position, currentValue: item.position, timeWindow: capturedAt, affectedEntity: item.query }]
      }));
      lowHangingCovered.add(item.query);
    }

    // Unterperformende Money-Pages (CTR-Gap in den Top-10). Dedupe je URL.
    const moneyCovered = await this.coveredEntities(projectId, "money_page", "affected_urls");
    for (const item of analyzeCtrGap(rows, { limit: 10 })) {
      if (moneyCovered.has(item.pageUrl)) continue;
      created.push(await this.createOpportunity(projectId, {
        type: "money_page",
        affectedUrls: [item.pageUrl],
        affectedKeywords: [item.query],
        currentState: `CTR ${item.ctr} below benchmark ${item.expectedCtr} at position ${item.position} (${item.missedClicks} missed clicks)`,
        recommendedAction: "Improve the SERP snippet (title, meta description, structured data) to close the CTR gap",
        expectedImpact: clamp(Math.round(item.missedClicks / 50), 1, 5),
        effort: 2,
        confidence: 0.6,
        businessValue,
        urgency: 3,
        validationMetric: "ctr",
        evidence: [{ source: "gsc", sourceConfidence: "B", metric: "ctr", beforeValue: item.ctr, currentValue: item.ctr, timeWindow: capturedAt, affectedEntity: item.pageUrl }]
      }));
      moneyCovered.add(item.pageUrl);
    }

    // Kannibalisierung (mehrere eigene Seiten je Query). Dedupe je Query.
    const cannibalCovered = await this.coveredEntities(projectId, "cannibalization", "affected_keywords");
    for (const item of analyzeCannibalization(rows, { limit: 10 })) {
      if (cannibalCovered.has(item.query)) continue;
      created.push(await this.createOpportunity(projectId, {
        type: "cannibalization",
        affectedUrls: item.pages.map((page) => page.pageUrl),
        affectedKeywords: [item.query],
        currentState: `${item.pages.length} own pages compete for "${item.query}"`,
        recommendedAction: "Consolidate or differentiate the competing pages and pick one canonical target",
        expectedImpact: 3,
        effort: 3,
        confidence: 0.6,
        businessValue,
        urgency: 2,
        validationMetric: "single_dominant_page",
        evidence: [{ source: "gsc", sourceConfidence: "B", metric: "competing_pages", beforeValue: item.pages.length, currentValue: item.pages.length, timeWindow: capturedAt, affectedEntity: item.query }]
      }));
      cannibalCovered.add(item.query);
    }

    return { created: created.length, opportunities: created };
  }

  async generateInternalLinkOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult> {
    const businessValue = await this.siteBusinessValue(projectId, siteId);
    // Ohne erfassten Linkgraph wäre jede URL ein "Orphan" — dann gibt es kein belastbares Signal.
    const edgeCount = Number((await this.db.prepare(`SELECT COUNT(*) AS c FROM internal_link_edges WHERE site_id = ?`).get(siteId) as { c: number }).c);
    if (edgeCount === 0) {
      return { created: 0, opportunities: [] };
    }

    const orphans = await this.db.prepare(`
      SELECT du.url AS url FROM discovered_urls du
      WHERE du.site_id = ? AND NOT EXISTS (
        SELECT 1 FROM internal_link_edges e WHERE e.site_id = du.site_id AND e.to_url = du.normalized_url
      )
      ORDER BY du.depth ASC, du.url ASC LIMIT 20
    `).all(siteId) as Array<{ url: string }>;

    const covered = await this.coveredEntities(projectId, "internal_link_gap", "affected_urls");
    const now = new Date().toISOString();
    const created: Opportunity[] = [];
    for (const row of orphans) {
      if (covered.has(row.url)) continue;
      created.push(await this.createOpportunity(projectId, {
        type: "internal_link_gap",
        affectedUrls: [row.url],
        currentState: "no internal inlinks (orphan)",
        recommendedAction: "Add internal links from relevant hub and related pages to this URL",
        expectedImpact: 2,
        effort: 1,
        confidence: 0.7,
        businessValue,
        urgency: 2,
        validationMetric: "inlink_count",
        evidence: [{ source: "crawl", sourceConfidence: "A", metric: "inlink_count", beforeValue: 0, currentValue: 0, timeWindow: now, affectedEntity: row.url }]
      }));
      covered.add(row.url);
    }
    return { created: created.length, opportunities: created };
  }

  async generateAeoOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult> {
    const businessValue = await this.siteBusinessValue(projectId, siteId);
    // Neueste AEO-Bewertung je URL; nur schwache Seiten (Score < 60). Evidenz = Crawl/Content (Klasse A).
    const weak = await this.db.prepare(`
      SELECT a.url AS url, a.score AS score FROM aeo_assessments a
      WHERE a.site_id = ? AND a.id = (
        SELECT x.id FROM aeo_assessments x WHERE x.site_id = a.site_id AND x.url = a.url ORDER BY x.assessed_at DESC, x.id DESC LIMIT 1
      ) AND a.score < 60
    `).all(siteId) as Array<{ url: string; score: number }>;

    const covered = await this.coveredEntities(projectId, "aeo", "affected_urls");
    const now = new Date().toISOString();
    const created: Opportunity[] = [];
    for (const row of weak) {
      if (covered.has(row.url)) continue;
      created.push(await this.createOpportunity(projectId, {
        type: "aeo",
        affectedUrls: [row.url],
        currentState: `low AEO readiness (score ${row.score}/100)`,
        recommendedAction: "Add structured data, concise answers and question-style headings to improve answer-engine readiness",
        expectedImpact: 2,
        effort: 2,
        confidence: 0.7,
        businessValue,
        urgency: 2,
        validationMetric: "aeo_score",
        evidence: [{ source: "crawl", sourceConfidence: "A", metric: "aeo_score", beforeValue: row.score, currentValue: row.score, timeWindow: now, affectedEntity: row.url }]
      }));
      covered.add(row.url);
    }
    return { created: created.length, opportunities: created };
  }

  async generateAllOpportunities(projectId: string, siteId: string): Promise<GenerateOpportunitiesResult> {
    const opportunities = [
      ...(await this.generateIndexabilityOpportunities(projectId, siteId)).opportunities,
      ...(await this.generateSearchOpportunities(projectId, siteId)).opportunities,
      ...(await this.generateInternalLinkOpportunities(projectId, siteId)).opportunities,
      ...(await this.generateAeoOpportunities(projectId, siteId)).opportunities
    ];
    return { created: opportunities.length, opportunities };
  }

  private async siteBusinessValue(projectId: string, siteId: string): Promise<number> {
    const site = await this.db.prepare(`SELECT business_value FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId) as { business_value?: number } | undefined;
    if (!site) {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
    return typeof site.business_value === "number" ? site.business_value : 50;
  }

  private async coveredEntities(projectId: string, type: OpportunityType, field: "affected_urls" | "affected_keywords"): Promise<Set<string>> {
    const rows = await this.db.prepare(`SELECT ${field} AS payload FROM opportunities WHERE project_id = ? AND type = ? AND status NOT IN ('dismissed', 'expired', 'validated')`).all(projectId, type);
    const covered = new Set<string>();
    for (const row of rows) {
      for (const value of JSON.parse(String((row as { payload: string }).payload)) as string[]) {
        covered.add(value);
      }
    }
    return covered;
  }

  private async latestSearchRows(siteId: string): Promise<{ capturedAt: string | null; rows: SearchPerformanceMetricRow[] }> {
    const max = await this.db.prepare(`SELECT MAX(captured_at) AS c FROM search_performance_rows WHERE site_id = ?`).get(siteId) as { c?: string | null } | undefined;
    const capturedAt = max && max.c ? String(max.c) : null;
    if (!capturedAt) {
      return { capturedAt: null, rows: [] };
    }
    const rows = await this.db.prepare(`SELECT query, page_url, clicks, impressions, ctr, position FROM search_performance_rows WHERE site_id = ? AND captured_at = ?`).all(siteId, capturedAt) as Array<{ query: string; page_url: string; clicks: number; impressions: number; ctr: number; position: number }>;
    return {
      capturedAt,
      rows: rows.map((row) => ({ query: String(row.query), pageUrl: String(row.page_url), clicks: Number(row.clicks), impressions: Number(row.impressions), ctr: Number(row.ctr), position: Number(row.position) }))
    };
  }

  private async assembleOpportunity(row: Record<string, unknown>): Promise<Opportunity> {
    const id = String(row.id);
    const evidence = (await this.db.prepare(`SELECT * FROM opportunity_evidence WHERE opportunity_id = ? ORDER BY id ASC`).all(id)).map((ev) => this.mapEvidence(ev));
    const sourceAnchorRaw = row.source_anchor === null || row.source_anchor === undefined ? null : String(row.source_anchor);
    return {
      id,
      projectId: String(row.project_id),
      type: String(row.type) as OpportunityType,
      affectedUrls: JSON.parse(String(row.affected_urls)) as string[],
      affectedKeywords: JSON.parse(String(row.affected_keywords)) as string[],
      affectedClusters: JSON.parse(String(row.affected_clusters)) as string[],
      sourceAnchor: sourceAnchorRaw ? (JSON.parse(sourceAnchorRaw) as SourceAnchor) : undefined,
      evidence,
      currentState: String(row.current_state),
      recommendedAction: String(row.recommended_action),
      expectedImpact: Number(row.expected_impact),
      effort: Number(row.effort),
      confidence: Number(row.confidence),
      businessValue: Number(row.business_value),
      urgency: Number(row.urgency),
      priority: Number(row.priority),
      validationMetric: String(row.validation_metric),
      owner: String(row.owner),
      status: String(row.status) as OpportunityStatus,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      expiresAt: String(row.expires_at)
    };
  }

  private mapEvidence(row: Record<string, unknown>): Evidence {
    return {
      source: String(row.source),
      sourceConfidence: String(row.source_confidence) as Evidence["sourceConfidence"],
      metric: String(row.metric),
      beforeValue: JSON.parse(String(row.before_value)) as number | string,
      currentValue: JSON.parse(String(row.current_value)) as number | string,
      timeWindow: String(row.time_window),
      affectedEntity: String(row.affected_entity)
    };
  }
}
