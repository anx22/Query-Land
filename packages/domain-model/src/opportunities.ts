import { DomainValidationError } from "./errors.js";
import type { SourceConfidence } from "./integrations.js";

export type OpportunityStatus = "open" | "planned" | "in_progress" | "implemented" | "validated" | "reopened" | "dismissed" | "expired";

/**
 * Status model (spec §6.5): open → planned → in_progress → implemented → validated | reopened |
 * dismissed | expired. Single source of truth for BOTH the API store (which enforces it) and the
 * web UI (which must only OFFER valid transitions — otherwise a bulk action offers a target the
 * server rejects, producing a "0 aktualisiert, N übersprungen" dead-end).
 */
export const OPPORTUNITY_STATUS_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  open: ["planned", "in_progress", "dismissed", "expired"],
  planned: ["in_progress", "open", "dismissed", "expired"],
  in_progress: ["implemented", "planned", "dismissed", "expired"],
  implemented: ["validated", "reopened", "dismissed", "expired"],
  validated: ["reopened", "expired"],
  reopened: ["in_progress", "planned", "implemented", "dismissed", "expired"],
  dismissed: ["open"],
  expired: ["open"],
};

/** Valid next statuses from a given status. */
export function nextOpportunityStatuses(status: OpportunityStatus): OpportunityStatus[] {
  return OPPORTUNITY_STATUS_TRANSITIONS[status] ?? [];
}

/** Whether a transition is allowed by the status model. */
export function canTransitionOpportunity(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return nextOpportunityStatuses(from).includes(to);
}

export interface Evidence {
  source: string;
  sourceConfidence: SourceConfidence;
  metric: string;
  beforeValue: number | string;
  currentValue: number | string;
  timeWindow: string;
  affectedEntity: string;
}

export interface SourceAnchor {
  repositoryPath: string;
  templateName: string;
  confidence: "exact" | "manifest" | "heuristic";
}

export interface Opportunity {
  id: string;
  projectId: string;
  type: "technical_fix" | "low_hanging_keyword" | "cannibalization" | "money_page" | "internal_link_gap" | "aeo";
  affectedUrls: string[];
  affectedKeywords: string[];
  affectedClusters: string[];
  sourceAnchor?: SourceAnchor;
  evidence: Evidence[];
  currentState: string;
  recommendedAction: string;
  expectedImpact: number;
  effort: number;
  confidence: number;
  businessValue: number;
  urgency: number;
  priority: number;
  validationMetric: string;
  owner: string;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export function scoreOpportunity(input: Pick<Opportunity, "expectedImpact" | "confidence" | "businessValue" | "urgency" | "effort">): number {
  if (input.effort <= 0) {
    throw new DomainValidationError("Opportunity effort must be greater than zero.");
  }

  return Math.round((input.expectedImpact * input.confidence * input.businessValue * input.urgency * 100) / input.effort);
}

export function hasRequiredEvidence(opportunity: Pick<Opportunity, "evidence">): boolean {
  return opportunity.evidence.some((item) => ["A", "B", "C"].includes(item.sourceConfidence));
}
