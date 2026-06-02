export type SourceConfidence = "A" | "B" | "C" | "D" | "E";

export type OpportunityStatus =
  | "open"
  | "planned"
  | "in_progress"
  | "implemented"
  | "validated"
  | "reopened"
  | "dismissed"
  | "expired";

export type IntegrationSourceType =
  | "gsc"
  | "ga4"
  | "matomo"
  | "server_logs"
  | "crawler"
  | "sitemap"
  | "robots"
  | "psi"
  | "lighthouse"
  | "cms"
  | "serp_provider"
  | "backlink_provider";

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

export interface SiteScope {
  id: string;
  hostname: string;
  pathScope: string;
  market: {
    country: string;
    language: string;
    device: "desktop" | "mobile";
    searchEngine: "google" | "bing";
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  sites: SiteScope[];
  competitors: string[];
  keywordGroups: string[];
  businessPriorities: Array<{ label: string; value: number; urlPattern: string }>;
}

export interface IntegrationAccount {
  id: string;
  projectId: string;
  sourceType: IntegrationSourceType;
  displayName: string;
  status: "connected" | "needs_review" | "not_connected";
  sourceConfidence: SourceConfidence;
  quotaUsed: number;
  quotaLimit: number;
  lastSyncAt?: string;
}

export interface JobRun {
  id: string;
  projectId: string;
  kind: "crawl" | "gsc_import" | "ga4_import" | "source_map" | "report";
  status: "queued" | "running" | "succeeded" | "failed" | "blocked";
  idempotencyKey: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface SourceTemplateMap {
  id: string;
  routePattern: string;
  templateName: string;
  repositoryPath: string;
  confidence: SourceAnchor["confidence"];
  lastVerifiedAt: string;
}

export interface SeoMemorySnapshot {
  principles: string[];
  foundationGate: string[];
  deliveryWave: "foundation";
  sourceOfTruth: string[];
}

export function scoreOpportunity(input: Pick<Opportunity, "expectedImpact" | "confidence" | "businessValue" | "urgency" | "effort">): number {
  if (input.effort <= 0) {
    throw new Error("Opportunity effort must be greater than zero.");
  }

  return Math.round(
    (input.expectedImpact * input.confidence * input.businessValue * input.urgency * 100) / input.effort,
  );
}

export function hasRequiredEvidence(opportunity: Pick<Opportunity, "evidence">): boolean {
  return opportunity.evidence.some((item) => ["A", "B", "C"].includes(item.sourceConfidence));
}
