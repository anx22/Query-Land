export type SourceConfidence = "A" | "B" | "C" | "D" | "E";
export type IntegrationProvider = "gsc" | "ga4" | "matomo" | "pagespeed" | "lighthouse" | "serverlogs" | "sitemap" | "robots" | "crawler" | "cms" | "serp" | "backlink" | "keyword";
export type IntegrationStatus = "disconnected" | "pending" | "connected" | "degraded" | "error";

export interface IntegrationAccount {
  id: string;
  projectId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  sourceConfidence: SourceConfidence;
  quotaRemaining: number | null;
  freshness: string | null;
}

const confidenceByProvider: Record<IntegrationProvider, SourceConfidence> = {
  gsc: "B",
  ga4: "A",
  matomo: "A",
  pagespeed: "B",
  lighthouse: "A",
  serverlogs: "A",
  sitemap: "A",
  robots: "A",
  crawler: "A",
  cms: "A",
  serp: "C",
  backlink: "D",
  keyword: "D"
};

export function sourceConfidenceForProvider(provider: IntegrationProvider): SourceConfidence {
  return confidenceByProvider[provider];
}
