import type { SourceConfidence } from "@seo-tool/domain-model";

// LLM-Antwort-Provider-Vertrag (specs/ai-layer.md). V1: deterministischer Stub statt eines echten
// LLM (DEC-002). Confidence-Klasse E (LLM-Interpretation) — gemäß §2.3/§2.7 NIE als Evidenz nutzbar,
// nur als Tracking-Signal. Ein echter Adapter ersetzt nur answer(); Persistenz/Tagging bleiben gleich.

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

function hashString(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash ^ value.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

const deterministicProvider: AiProvider = {
  name: "deterministic-llm-stub",
  sourceConfidence: "E",
  answer({ prompt, market, ownDomain, brand }) {
    const seed = hashString(`${prompt}|${market}`);
    const cited: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      cited.push(`source-${((seed >>> (index * 3)) % 9) + 1}.example`);
    }
    const ourCited = ownDomain !== null && seed % 3 !== 0;
    if (ourCited && ownDomain) {
      cited.splice(seed % (cited.length + 1), 0, ownDomain);
    }
    const brandMentioned = brand !== null && (ourCited || seed % 2 === 0);
    const answer = `${cited.join(", ")} werden aktuell für "${prompt}" referenziert.${brandMentioned && brand ? ` ${brand} wird erwähnt.` : ""}`;
    return { answer, citedDomains: cited, brandMentioned, ourCited };
  }
};

export function getAiProvider(): AiProvider {
  return deterministicProvider;
}
