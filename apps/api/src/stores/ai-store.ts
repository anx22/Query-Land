import { randomUUID } from "node:crypto";
import {
  analyzeAeo,
  computeAiVisibilityScore,
  type AeoAssessment,
  type AeoCheck,
  type AiAnswerSnapshot,
  type AiPrompt,
  type AiVisibilityScore
} from "@seo-tool/domain-model";
import { getAiProvider } from "../ai/index.js";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

const DEFAULT_MARKET = "DE";

export interface AiStore {
  createAiPrompt(projectId: string, input: { prompt: string; market?: string }): AiPrompt;
  listAiPrompts(projectId: string): AiPrompt[];
  recordAiSnapshot(projectId: string, promptId: string): AiAnswerSnapshot;
  listAiSnapshots(projectId: string, promptId: string): AiAnswerSnapshot[];
  aiVisibilityScore(projectId: string): AiVisibilityScore;
  scanAeo(projectId: string, siteId: string, input: { url: string; content: string }): AeoAssessment;
  listAeoAssessments(projectId: string, siteId: string): AeoAssessment[];
}

export function createAiStore(db: SQLiteDatabase, audit: AuditLog): AiStore {
  return new SQLiteAiStore(db, audit);
}

function hostOf(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).host || null;
  } catch {
    return null;
  }
}

class SQLiteAiStore implements AiStore {
  constructor(private readonly db: SQLiteDatabase, private readonly audit: AuditLog) {}

  private assertProject(projectId: string): void {
    if (!this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId)) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
  }

  private requireSite(projectId: string, siteId: string): { baseUrl: string } {
    const site = this.db.prepare(`SELECT base_url FROM sites WHERE id = ? AND project_id = ?`).get(siteId, projectId) as { base_url?: string } | undefined;
    if (!site || typeof site.base_url !== "string") {
      throw new RequestError(404, "unknown_site", "Site not found for project");
    }
    return { baseUrl: site.base_url };
  }

  createAiPrompt(projectId: string, input: { prompt: string; market?: string }): AiPrompt {
    this.assertProject(projectId);
    if (typeof input.prompt !== "string" || input.prompt.trim() === "") {
      throw new RequestError(400, "missing_field", "prompt is required");
    }
    const prompt: AiPrompt = {
      id: `aip-${randomUUID()}`,
      projectId,
      prompt: input.prompt.trim(),
      market: (input.market ?? DEFAULT_MARKET).trim() || DEFAULT_MARKET,
      createdAt: new Date().toISOString()
    };
    this.db.prepare(`INSERT INTO ai_prompts (id, project_id, prompt, market, created_at) VALUES (?, ?, ?, ?, ?)`).run(prompt.id, prompt.projectId, prompt.prompt, prompt.market, prompt.createdAt);
    this.audit("system", "ai_prompt.create", "ai_prompt", prompt.id, { projectId });
    return prompt;
  }

  listAiPrompts(projectId: string): AiPrompt[] {
    this.assertProject(projectId);
    return this.db.prepare(`SELECT * FROM ai_prompts WHERE project_id = ? ORDER BY created_at ASC, id ASC`).all(projectId).map((row) => this.mapPrompt(row as Record<string, unknown>));
  }

  recordAiSnapshot(projectId: string, promptId: string): AiAnswerSnapshot {
    const prompt = this.db.prepare(`SELECT prompt, market FROM ai_prompts WHERE id = ? AND project_id = ?`).get(promptId, projectId) as { prompt?: string; market?: string } | undefined;
    if (!prompt || typeof prompt.prompt !== "string") {
      throw new RequestError(404, "unknown_prompt", "AI prompt not found for project");
    }
    const site = this.db.prepare(`SELECT base_url FROM sites WHERE project_id = ? ORDER BY created_at ASC LIMIT 1`).get(projectId) as { base_url?: string } | undefined;
    const ownDomain = hostOf(site?.base_url);
    const brand = ownDomain ? (ownDomain.split(".")[0] || ownDomain) : null;

    const provider = getAiProvider();
    const result = provider.answer({ prompt: prompt.prompt, market: prompt.market ?? DEFAULT_MARKET, ownDomain, brand });
    const snapshot: AiAnswerSnapshot = {
      id: `ais-${randomUUID()}`,
      projectId,
      promptId,
      answer: result.answer,
      citedDomains: result.citedDomains,
      brandMentioned: result.brandMentioned,
      ourCited: result.ourCited,
      capturedAt: new Date().toISOString(),
      sourceConfidence: provider.sourceConfidence
    };
    this.db.prepare(`INSERT INTO ai_answer_snapshots (id, project_id, prompt_id, answer, cited_domains, brand_mentioned, our_cited, captured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      snapshot.id, snapshot.projectId, snapshot.promptId, snapshot.answer, JSON.stringify(snapshot.citedDomains), snapshot.brandMentioned ? 1 : 0, snapshot.ourCited ? 1 : 0, snapshot.capturedAt, snapshot.sourceConfidence
    );
    this.audit("system", "ai_snapshot.record", "ai_prompt", promptId, { projectId, ourCited: snapshot.ourCited });
    return snapshot;
  }

  listAiSnapshots(projectId: string, promptId: string): AiAnswerSnapshot[] {
    if (!this.db.prepare(`SELECT 1 FROM ai_prompts WHERE id = ? AND project_id = ?`).get(promptId, projectId)) {
      throw new RequestError(404, "unknown_prompt", "AI prompt not found for project");
    }
    return this.db.prepare(`SELECT * FROM ai_answer_snapshots WHERE prompt_id = ? ORDER BY captured_at ASC, id ASC`).all(promptId).map((row) => this.mapSnapshot(row as Record<string, unknown>));
  }

  aiVisibilityScore(projectId: string): AiVisibilityScore {
    this.assertProject(projectId);
    // Neuester Snapshot je Prompt (das getrackte Set).
    const rows = this.db.prepare(`
      SELECT s.our_cited AS our_cited, s.brand_mentioned AS brand_mentioned
      FROM ai_answer_snapshots s
      WHERE s.project_id = ? AND s.id = (
        SELECT x.id FROM ai_answer_snapshots x WHERE x.prompt_id = s.prompt_id ORDER BY x.captured_at DESC, x.id DESC LIMIT 1
      )
    `).all(projectId) as Array<{ our_cited: number; brand_mentioned: number }>;
    return computeAiVisibilityScore(rows.map((row) => ({ ourCited: Number(row.our_cited) === 1, brandMentioned: Number(row.brand_mentioned) === 1 })));
  }

  scanAeo(projectId: string, siteId: string, input: { url: string; content: string }): AeoAssessment {
    this.requireSite(projectId, siteId);
    if (typeof input.url !== "string" || input.url.trim() === "") {
      throw new RequestError(400, "missing_field", "url is required");
    }
    if (typeof input.content !== "string") {
      throw new RequestError(400, "missing_field", "content is required");
    }
    const result = analyzeAeo(input.content);
    const assessment: AeoAssessment = {
      id: `aeo-${randomUUID()}`,
      projectId,
      siteId,
      url: input.url.trim(),
      score: result.score,
      checks: result.checks,
      sourceConfidence: "A",
      assessedAt: new Date().toISOString()
    };
    this.db.prepare(`INSERT INTO aeo_assessments (id, project_id, site_id, url, score, checks, source_confidence, assessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      assessment.id, assessment.projectId, assessment.siteId, assessment.url, assessment.score, JSON.stringify(assessment.checks), assessment.sourceConfidence, assessment.assessedAt
    );
    this.audit("system", "aeo.scan", "site", siteId, { projectId, url: assessment.url, score: assessment.score });
    return assessment;
  }

  listAeoAssessments(projectId: string, siteId: string): AeoAssessment[] {
    this.requireSite(projectId, siteId);
    // Neueste Bewertung je URL.
    return this.db.prepare(`
      SELECT a.* FROM aeo_assessments a
      WHERE a.site_id = ? AND a.id = (
        SELECT x.id FROM aeo_assessments x WHERE x.site_id = a.site_id AND x.url = a.url ORDER BY x.assessed_at DESC, x.id DESC LIMIT 1
      )
      ORDER BY a.score ASC, a.url ASC
    `).all(siteId).map((row) => this.mapAssessment(row as Record<string, unknown>));
  }

  private mapPrompt(row: Record<string, unknown>): AiPrompt {
    return { id: String(row.id), projectId: String(row.project_id), prompt: String(row.prompt), market: String(row.market), createdAt: String(row.created_at) };
  }

  private mapSnapshot(row: Record<string, unknown>): AiAnswerSnapshot {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      promptId: String(row.prompt_id),
      answer: String(row.answer),
      citedDomains: JSON.parse(String(row.cited_domains)) as string[],
      brandMentioned: Number(row.brand_mentioned) === 1,
      ourCited: Number(row.our_cited) === 1,
      capturedAt: String(row.captured_at),
      sourceConfidence: String(row.source_confidence) as AiAnswerSnapshot["sourceConfidence"]
    };
  }

  private mapAssessment(row: Record<string, unknown>): AeoAssessment {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      siteId: String(row.site_id),
      url: String(row.url),
      score: Number(row.score),
      checks: JSON.parse(String(row.checks)) as AeoCheck[],
      sourceConfidence: String(row.source_confidence) as AeoAssessment["sourceConfidence"],
      assessedAt: String(row.assessed_at)
    };
  }
}
