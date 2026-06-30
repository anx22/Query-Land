import type { SourceConfidence } from "@seo-tool/domain-model";

// LLM-Antwort-Provider-Vertrag (specs/ai-layer.md). Bis ein echtes LLM angebunden ist, liefert
// dieser Provider KEINE Antwort — KI-Citations bleiben ein ehrlicher Leerzustand. Confidence-Klasse E
// (LLM-Interpretation) — gemäß §2.3/§2.7 NIE als Evidenz nutzbar, nur als Tracking-Signal. Ein echter
// Adapter ersetzt nur answer(); Persistenz/Tagging bleiben gleich.

export interface AiAnswerInput {
  prompt: string;
  market: string;
  ownDomain: string | null;
  brand: string | null;
}

export interface AiAnswerResult {
  answer: string;
  citedDomains: string[];
  brandMentioned: boolean;
  ourCited: boolean;
}

export interface AiProvider {
  readonly name: string;
  readonly sourceConfidence: SourceConfidence;
  answer(input: AiAnswerInput): AiAnswerResult;
}

// Kein echtes LLM verbunden → keine Antwort, keine Citations. Ein echter Adapter ersetzt nur diese
// answer()-Implementierung; Confidence bleibt Klasse E (nie Evidenz).
const emptyProvider: AiProvider = {
  name: "unconfigured-llm",
  sourceConfidence: "E",
  answer(_input: AiAnswerInput): AiAnswerResult {
    return { answer: "", citedDomains: [], brandMentioned: false, ourCited: false };
  }
};

export function getAiProvider(): AiProvider {
  return emptyProvider;
}

/**
 * Whether a real LLM answer-provider is wired. While false, KI-Citations are an honest empty
 * state (all-zero), not a measurement — the UI must disclose this instead of showing "0 %" as
 * if it were a result.
 */
export function isAiProviderConfigured(): boolean {
  return getAiProvider().name !== "unconfigured-llm";
}
