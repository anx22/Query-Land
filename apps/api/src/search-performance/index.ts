import type { SourceConfidence } from "@seo-tool/domain-model";

// Search-Analytics-Provider-Vertrag (specs/integrations.md, §4.2). Bis ein echter
// Google-Search-Console-Adapter (OAuth) angebunden ist, liefert dieser Provider KEINE Daten —
// die Oberfläche zeigt ehrliche Leerzustände statt Platzhaltern. Ein echter Adapter ersetzt nur
// fetch(); Contract, Persistenz und Confidence-Tagging (Klasse B) bleiben gleich.

export interface SearchAnalyticsRow {
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsFetchInput {
  baseUrl: string;
  market: string;
}

export interface SearchAnalyticsProvider {
  readonly name: string;
  readonly sourceConfidence: SourceConfidence;
  fetch(input: SearchAnalyticsFetchInput): SearchAnalyticsRow[];
}

// Kein echter Adapter verbunden → keine Zeilen. Sobald GSC (OAuth) angebunden ist, ersetzt der
// echte Adapter nur diese fetch()-Implementierung; Persistenz und Confidence-Klasse B bleiben.
const emptyProvider: SearchAnalyticsProvider = {
  name: "unconfigured-gsc",
  sourceConfidence: "B",
  fetch(_input: SearchAnalyticsFetchInput): SearchAnalyticsRow[] {
    return [];
  }
};

export function getSearchAnalyticsProvider(): SearchAnalyticsProvider {
  return emptyProvider;
}
