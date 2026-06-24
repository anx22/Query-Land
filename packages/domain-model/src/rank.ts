import type { SourceConfidence } from "./integrations.js";

// Modul 3 / specs/rank-tracking.md: Rank- & SERP-Tracking auf dem eigenen Keyword-Set.
// SERP nur über saubere, ratenbegrenzte Quellen (Compliance); in V1 ein deterministischer
// Provider-Stub (kein lizenzierter Provider, DEC-002).

export type SerpDevice = "desktop" | "mobile";

export interface SerpResult {
  position: number;
  url: string;
  domain: string;
}

export interface SerpSnapshot {
  id: string;
  projectId: string;
  keywordId: string;
  market: string;
  device: SerpDevice;
  capturedAt: string;
  results: SerpResult[];
  serpFeatures: string[];
  ownPosition: number | null;
  sourceConfidence: SourceConfidence;
}

export interface RankSnapshot {
  id: string;
  projectId: string;
  keywordId: string;
  serpSnapshotId: string | null;
  market: string;
  device: SerpDevice;
  position: number | null;
  url: string | null;
  capturedAt: string;
  sourceConfidence: SourceConfidence;
}

export interface SerpDiff {
  keywordId: string;
  ownPositionBefore: number | null;
  ownPositionAfter: number | null;
  ownPositionDelta: number | null;
  enteredDomains: string[];
  leftDomains: string[];
  gainedFeatures: string[];
  lostFeatures: string[];
}

export const SERP_DEVICES: readonly SerpDevice[] = ["desktop", "mobile"];
