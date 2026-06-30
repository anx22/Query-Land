import type { SerpDevice, SerpResult, SourceConfidence } from "@seo-tool/domain-model";
import type { AsyncDatabase } from "../db/index.js";
import { countryFilterForMarket, mapAveragePosition } from "../oauth/gsc-client.js";
import { resolveGscAdapterContext, searchAnalyticsWindow } from "../oauth/gsc-credentials.js";

// SERP-/Ranking-Provider-Vertrag (specs/rank-tracking.md). Ohne verbundene Ranking-Quelle liefert
// der Provider KEINE Ergebnisse (ehrlicher Leerzustand). Ist Google Search Console verbunden, gibt
// resolveSerpProvider() die eigene Durchschnittsposition zurück (Konfidenz B) — ohne Wettbewerber-
// SERP. Ein lizenzierter SERP-Provider könnte später results/features ergänzen.

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
  fetch(input: SerpFetchInput): SerpFetchResult | Promise<SerpFetchResult>;
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

/**
 * Resolve the ranking provider for a project: a GSC-backed adapter (own average position per query)
 * when Google Search Console is connected, otherwise the empty provider. The adapter returns no
 * competitor results — only ownPosition from GSC search-analytics, which is enough to drive rank
 * snapshots and the visibility score.
 */
export async function resolveSerpProvider(db: AsyncDatabase, projectId: string): Promise<SerpProvider> {
  const ctx = await resolveGscAdapterContext(db, projectId);
  if (!ctx) return emptyProvider;

  return {
    name: "google-search-console",
    sourceConfidence: "B",
    async fetch({ phrase, market }: SerpFetchInput): Promise<SerpFetchResult> {
      const country = countryFilterForMarket(market);
      const { startDate, endDate } = searchAnalyticsWindow();
      const filters = [{ dimension: "query", operator: "equals", expression: phrase }];
      if (country) filters.push({ dimension: "country", operator: "equals", expression: country });
      try {
        const rows = await ctx.client.querySearchAnalytics(ctx.creds.accessToken, ctx.creds.property, {
          startDate,
          endDate,
          dimensions: [],
          dimensionFilterGroups: [{ filters }],
          rowLimit: 1,
        });
        // rank_snapshots.position is an integer rank; GSC reports a fractional average position,
        // so round it. The exact fractional value stays available in search_performance_rows.
        const avg = mapAveragePosition(rows);
        return { results: [], serpFeatures: [], ownPosition: avg === null ? null : Math.round(avg) };
      } catch {
        return { results: [], serpFeatures: [], ownPosition: null };
      }
    }
  };
}
