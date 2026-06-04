import type { SourceConfidence } from "./integrations.js";

export type OpportunityStatus = "open" | "planned" | "in_progress" | "implemented" | "validated" | "reopened" | "dismissed" | "expired";

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
    throw new Error("Opportunity effort must be greater than zero.");
  }

  return Math.round((input.expectedImpact * input.confidence * input.businessValue * input.urgency * 100) / input.effort);
}

export function hasRequiredEvidence(opportunity: Pick<Opportunity, "evidence">): boolean {
  return opportunity.evidence.some((item) => ["A", "B", "C"].includes(item.sourceConfidence));
}
