import type { SourceConfidence } from "./integrations.js";

// Modul 3 / specs/keyword-intelligence.md: kuratiertes Keyword-Universum mit Intent-,
// Brand- und Funnel-Klassifikation. DACH-Fokus (DEC-003).

export type KeywordIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational"
  | "local"
  | "comparison"
  | "problem_solving";

export type FunnelStage = "awareness" | "consideration" | "decision" | "retention";

export type KeywordSource = "gsc" | "manual" | "competitor" | "serp";

export interface KeywordGroup {
  id: string;
  projectId: string;
  name: string;
  topic: string;
  createdAt: string;
}

export interface Keyword {
  id: string;
  projectId: string;
  groupId: string | null;
  phrase: string;
  normalizedPhrase: string;
  intent: KeywordIntent;
  brand: boolean;
  funnelStage: FunnelStage;
  market: string;
  targetUrl: string | null;
  source: KeywordSource;
  sourceConfidence: SourceConfidence;
  createdAt: string;
  updatedAt: string;
}

export const KEYWORD_INTENTS: readonly KeywordIntent[] = ["informational", "commercial", "transactional", "navigational", "local", "comparison", "problem_solving"];
export const FUNNEL_STAGES: readonly FunnelStage[] = ["awareness", "consideration", "decision", "retention"];
export const KEYWORD_SOURCES: readonly KeywordSource[] = ["gsc", "manual", "competitor", "serp"];

export function normalizeKeyword(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

// Deterministische, DACH+EN Intent-Heuristik. Reihenfolge ist die Priorität.
const INTENT_PATTERNS: ReadonlyArray<{ intent: KeywordIntent; pattern: RegExp }> = [
  { intent: "transactional", pattern: /\b(kaufen|buy|bestellen|order|preis|price|kosten|g[üu]nstig|cheap|deal|rabatt|shop|abo|subscribe|buchen)\b/ },
  { intent: "comparison", pattern: /\b(vs|versus|vergleich|compare|comparison|beste[rsn]?|best|test|review|bewertung|alternative|alternativen)\b/ },
  { intent: "local", pattern: /(in der n[äa]he|near me|in meiner n[äa]he|vor ort|standort)/ },
  { intent: "problem_solving", pattern: /\b(problem|fehler|error|fix|beheben|l[öo]sung|solve|troubleshoot)\b|funktioniert nicht|not working/ },
  { intent: "navigational", pattern: /\b(login|anmelden|account|konto|kontakt|contact|impressum|dashboard|portal)\b/ },
  { intent: "commercial", pattern: /\b(service|agentur|agency|tool|software|anbieter|provider|dienstleister|beratung|consulting|plattform|platform)\b/ },
  { intent: "informational", pattern: /\b(wie|was ist|what is|how to|guide|anleitung|tutorial|warum|why|tipps|tips|ideen|bedeutung|definition)\b/ }
];

export function classifyIntent(phrase: string): KeywordIntent {
  const text = normalizeKeyword(phrase);
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(text)) {
      return intent;
    }
  }
  return "informational";
}

export function classifyFunnelStage(intent: KeywordIntent): FunnelStage {
  switch (intent) {
    case "transactional":
    case "navigational":
    case "local":
      return "decision";
    case "commercial":
    case "comparison":
      return "consideration";
    default:
      return "awareness";
  }
}

export function isBrandKeyword(phrase: string, brandTerms: string[]): boolean {
  const text = normalizeKeyword(phrase);
  return brandTerms.some((term) => {
    const needle = normalizeKeyword(term);
    return needle.length > 0 && text.includes(needle);
  });
}
