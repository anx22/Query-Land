import type { SerpDevice, SerpResult, SourceConfidence } from "@seo-tool/domain-model";

// SERP-Provider-Vertrag (specs/rank-tracking.md). Bis eine echte Ranking-Quelle (GSC-Position
// bzw. ein lizenzierter SERP-Provider) angebunden ist, liefert dieser Provider KEINE Ergebnisse —
// die Oberfläche zeigt ehrliche Leerzustände. Ein echter Adapter ersetzt nur fetch(); Contract,
// Persistenz und Confidence-Tagging bleiben gleich.

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

// Keine Ranking-Quelle verbunden → keine Ergebnisse, keine eigene Position. Ein echter Adapter
// ersetzt nur diese fetch()-Implementierung.
const emptyProvider: SerpProvider = {
  name: "unconfigured-serp",
  sourceConfidence: "C",
  fetch(_input: SerpFetchInput): SerpFetchResult {
    return { results: [], serpFeatures: [], ownPosition: null };
  }
};

export function getSerpProvider(): SerpProvider {
  return emptyProvider;
}
