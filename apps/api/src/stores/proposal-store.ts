import { randomUUID } from "node:crypto";
import { PROPOSAL_KINDS, PROPOSAL_STATUSES, type Proposal, type ProposalKind, type ProposalStatus } from "@seo-tool/domain-model";
import type { AuditLog } from "./audit-log.js";
import { RequestError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export interface CreateProposalInput {
  kind: ProposalKind;
  title: string;
  body: string;
  opportunityId?: string | null;
  source?: string;
}

// Erlaubte Übergänge: ein Vorschlag wird genau einmal entschieden.
const ALLOWED_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  proposed: ["accepted", "rejected"],
  accepted: [],
  rejected: []
};

export interface ProposalStore {
  createProposal(projectId: string, input: CreateProposalInput): Promise<Proposal>;
  listProposals(projectId: string): Promise<Proposal[]>;
  transitionProposal(proposalId: string, status: ProposalStatus): Promise<Proposal>;
}

export function createProposalStore(db: AsyncDatabase, audit: AuditLog): ProposalStore {
  return new SQLiteProposalStore(db, audit);
}

class SQLiteProposalStore implements ProposalStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  async createProposal(projectId: string, input: CreateProposalInput): Promise<Proposal> {
    if (!(await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId))) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    if (!PROPOSAL_KINDS.includes(input.kind)) {
      throw new RequestError(400, "invalid_field", `kind must be one of ${PROPOSAL_KINDS.join(", ")}`);
    }
    if (typeof input.title !== "string" || input.title.trim() === "") {
      throw new RequestError(400, "missing_field", "title is required");
    }
    if (typeof input.body !== "string" || input.body.trim() === "") {
      throw new RequestError(400, "missing_field", "body is required");
    }
    const opportunityId = input.opportunityId ?? null;
    if (opportunityId && !(await this.db.prepare(`SELECT 1 FROM opportunities WHERE id = ? AND project_id = ?`).get(opportunityId, projectId))) {
      throw new RequestError(404, "unknown_opportunity", "Opportunity not found for project");
    }
    const now = new Date().toISOString();
    // Schreibtools erzeugen ausschließlich Status "proposed" — reviewpflichtig (§4.4).
    const proposal: Proposal = {
      id: `prop-${randomUUID()}`,
      projectId,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      opportunityId,
      status: "proposed",
      source: input.source && input.source.trim() !== "" ? input.source.trim() : "mcp",
      createdAt: now,
      updatedAt: now
    };
    await this.db.prepare(`INSERT INTO proposals (id, project_id, kind, title, body, opportunity_id, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      proposal.id, proposal.projectId, proposal.kind, proposal.title, proposal.body, proposal.opportunityId, proposal.status, proposal.source, proposal.createdAt, proposal.updatedAt
    );
    await this.audit("system", "proposal.create", "proposal", proposal.id, { projectId, kind: proposal.kind, source: proposal.source });
    return proposal;
  }

  async listProposals(projectId: string): Promise<Proposal[]> {
    if (!(await this.db.prepare(`SELECT 1 FROM projects WHERE id = ?`).get(projectId))) {
      throw new RequestError(404, "unknown_project", "Project not found");
    }
    return (await this.db.prepare(`SELECT * FROM proposals WHERE project_id = ? ORDER BY created_at DESC, id DESC`).all(projectId)).map((row) => this.mapProposal(row as Record<string, unknown>));
  }

  async transitionProposal(proposalId: string, status: ProposalStatus): Promise<Proposal> {
    const row = await this.db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(proposalId);
    if (!row) {
      throw new RequestError(404, "unknown_proposal", "Proposal not found");
    }
    if (!PROPOSAL_STATUSES.includes(status)) {
      throw new RequestError(400, "invalid_field", `status must be one of ${PROPOSAL_STATUSES.join(", ")}`);
    }
    const current = String((row as { status: string }).status) as ProposalStatus;
    if (!ALLOWED_TRANSITIONS[current].includes(status)) {
      throw new RequestError(409, "invalid_transition", `Cannot transition proposal from ${current} to ${status}`);
    }
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE proposals SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, proposalId);
    await this.audit("system", "proposal.transition", "proposal", proposalId, { from: current, to: status });
    return this.mapProposal(await this.db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(proposalId) as Record<string, unknown>);
  }

  private mapProposal(row: Record<string, unknown>): Proposal {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      kind: String(row.kind) as ProposalKind,
      title: String(row.title),
      body: String(row.body),
      opportunityId: row.opportunity_id === null || row.opportunity_id === undefined ? null : String(row.opportunity_id),
      status: String(row.status) as ProposalStatus,
      source: String(row.source),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }
}
