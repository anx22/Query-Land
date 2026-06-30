import type { SourceConfidence } from "@seo-tool/domain-model";
import type { AsyncDatabase } from "../db/index.js";
import { countryFilterForMarket, mapSearchAnalyticsRows } from "../oauth/gsc-client.js";
import { resolveGscAdapterContext, searchAnalyticsWindow } from "../oauth/gsc-credentials.js";

// Search-Analytics-Provider-Vertrag (specs/integrations.md, §4.2). Ohne verbundene Google Search
// Console liefert der Provider KEINE Daten (ehrlicher Leerzustand). Ist GSC für das Projekt
// verbunden, baut resolveSearchAnalyticsProvider() den echten Adapter — Persistenz und
// Confidence-Tagging (Klasse B) bleiben gleich.

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
  fetch(input: SearchAnalyticsFetchInput): SearchAnalyticsRow[] | Promise<SearchAnalyticsRow[]>;
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

/**
 * Resolve the search-analytics provider for a project: the real GSC adapter when the project has a
 * connected Google Search Console, otherwise the empty provider (honest empty state). The adapter
 * queries the query×page matrix for the last full GSC window, filtered to the project's country.
 */
export async function resolveSearchAnalyticsProvider(
  db: AsyncDatabase,
  projectId: string,
  market: string,
): Promise<SearchAnalyticsProvider> {
  const ctx = await resolveGscAdapterContext(db, projectId);
  if (!ctx) return emptyProvider;

  return {
    name: "google-search-console",
    sourceConfidence: "B",
    async fetch(): Promise<SearchAnalyticsRow[]> {
      const country = countryFilterForMarket(market);
      const { startDate, endDate } = searchAnalyticsWindow();
      try {
        const rows = await ctx.client.querySearchAnalytics(ctx.creds.accessToken, ctx.creds.property, {
          startDate,
          endDate,
          dimensions: ["query", "page"],
          dimensionFilterGroups: country
            ? [{ filters: [{ dimension: "country", operator: "equals", expression: country }] }]
            : undefined,
          rowLimit: 1000,
        });
        return mapSearchAnalyticsRows(rows);
      } catch {
        // Transient/auth errors degrade to an empty batch rather than crashing the sync.
        return [];
      }
    },
  };
}
