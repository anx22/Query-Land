export interface HealthSnapshot {
  status: "ok" | "degraded";
  service: string;
  version: string;
  checkedAt: string;
  checks: Array<{ name: string; status: "ok" | "warn" | "fail"; details?: string }>;
}

export interface SeoMemorySnapshot {
  principles: string[];
  foundationGate: string[];
  deliveryWave: "foundation" | "audit-core";
  sourceOfTruth: string[];
}
