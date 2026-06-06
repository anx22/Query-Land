import type { SourceConfidence } from "@seo-tool/domain-model";

// Search-Analytics-Provider-Vertrag (specs/integrations.md, §4.2). V1: ein deterministischer
// GSC-Stub statt eines produktiven OAuth-Flows (DEC-002). Ein echter Adapter ersetzt nur
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

// Themen-Vokabular und feste Positionsverteilung erzeugen reproduzierbar eine realistische
// Query×Page-Matrix mit Top-10-, Striking-Distance- und CTR-Gap-Mustern.
const TOPICS = [
  "pricing",
  "integration",
  "tutorial",
  "comparison",
  "api",
  "alternatives",
  "review",
  "setup guide",
  "best practices",
  "use cases",
  "pricing plans",
  "free trial"
];
const POSITIONS = [3, 12, 8, 15, 5, 18, 2, 11, 7, 14, 9, 19];

function hashString(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash ^ value.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
}

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || "example.com";
  } catch {
    return "example.com";
  }
}

function brandOf(host: string): string {
  const label = host.split(".")[0] || host;
  return label.replace(/[^a-z0-9]+/gi, " ").trim() || host;
}

const deterministicProvider: SearchAnalyticsProvider = {
  name: "deterministic-gsc-stub",
  sourceConfidence: "B",
  fetch({ baseUrl, market }) {
    const host = hostOf(baseUrl);
    const brand = brandOf(host);
    const seed = hashString(`${host}|${market}`);
    const rows: SearchAnalyticsRow[] = [];

    for (let index = 0; index < TOPICS.length; index += 1) {
      const topic = TOPICS[index];
      const position = POSITIONS[index];
      const query = `${brand} ${topic}`.trim();
      const pageUrl = `https://${host}/${slugify(topic)}`;
      const impressions = 300 + ((seed >>> (index % 16)) % 4000);
      // Einige Top-10-Zeilen unterperformen bewusst (CTR-Gap), Striking-Distance-Zeilen tragen
      // moderate CTR. So entstehen deterministisch echte Opportunity-Signale.
      const clickRate = position <= 10 ? (index % 2 === 0 ? 0.005 : 0.09) : 0.012;
      const clicks = Math.round(impressions * clickRate);
      const ctr = impressions > 0 ? Number((clicks / impressions).toFixed(4)) : 0;
      rows.push({ query, pageUrl, clicks, impressions, ctr, position });
    }

    // Ein Kannibalisierungs-Fall: dieselbe Query rankt mit einer zweiten Seite.
    const cannibalTopic = TOPICS[0];
    const cannibalQuery = `${brand} ${cannibalTopic}`.trim();
    const cannibalImpressions = 200 + (seed % 1500);
    const cannibalClicks = Math.round(cannibalImpressions * 0.01);
    rows.push({
      query: cannibalQuery,
      pageUrl: `https://${host}/${slugify(cannibalTopic)}-overview`,
      clicks: cannibalClicks,
      impressions: cannibalImpressions,
      ctr: cannibalImpressions > 0 ? Number((cannibalClicks / cannibalImpressions).toFixed(4)) : 0,
      position: POSITIONS[0] + 6
    });

    return rows;
  }
};

export function getSearchAnalyticsProvider(): SearchAnalyticsProvider {
  return deterministicProvider;
}
