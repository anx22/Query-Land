import type { SerpDevice, SerpResult, SourceConfidence } from "@seo-tool/domain-model";

// SERP-Provider-Vertrag (specs/rank-tracking.md). V1: ein deterministischer Stub statt eines
// lizenzierten Providers (DEC-002). Echte Adapter (saubere, ratenbegrenzte Quelle) ersetzen
// nur fetch(); Contract, Persistenz und Confidence-Tagging bleiben gleich.

export interface SerpFetchInput {
  phrase: string;
  market: string;
  device: SerpDevice;
  ownDomain: string | null;
}

export interface SerpFetchResult {
  results: SerpResult[];
  serpFeatures: string[];
  ownPosition: number | null;
}

export interface SerpProvider {
  readonly name: string;
  readonly sourceConfidence: SourceConfidence;
  fetch(input: SerpFetchInput): SerpFetchResult;
}

const ALL_FEATURES = ["featured_snippet", "people_also_ask", "image_pack", "video", "local_pack", "sitelinks"] as const;
const RESULT_COUNT = 10;

function hashString(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash ^ value.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "result";
}

// Deterministischer Stub: stabile Reihenfolge je phrase|market|device.
const deterministicProvider: SerpProvider = {
  name: "deterministic-stub",
  sourceConfidence: "C",
  fetch({ phrase, market, device, ownDomain }) {
    const seed = hashString(`${slugify(phrase)}|${market}|${device}`);
    const slug = slugify(phrase);
    const ownPosition = ownDomain && seed % 5 !== 0 ? (seed % RESULT_COUNT) + 1 : null;

    const results: SerpResult[] = [];
    for (let position = 1; position <= RESULT_COUNT; position += 1) {
      if (ownPosition === position && ownDomain) {
        results.push({ position, url: `https://${ownDomain}/${slug}`, domain: ownDomain });
        continue;
      }
      const competitor = ((seed >> (position % 16)) % 8) + 1;
      const domain = `competitor-${competitor}.example`;
      results.push({ position, url: `https://${domain}/${slug}`, domain });
    }

    const serpFeatures = ALL_FEATURES.filter((_, index) => ((seed >> index) & 1) === 1);
    return { results, serpFeatures, ownPosition };
  }
};

export function getSerpProvider(): SerpProvider {
  return deterministicProvider;
}
