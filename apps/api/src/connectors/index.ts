import type { IntegrationProvider, SourceConfidence } from "@seo-tool/domain-model";

// Connector-Vertrag gemäß specs/integrations.md (§4.2): source_type, auth_config (am
// integration_account), fetch, validate, normalize sowie quota_status/freshness (pro Lauf
// im Fetch-Ergebnis). Welle 1 verbindet noch keine produktiven OAuth-Flows, sondern legt
// Vertrag, Confidence-Tagging und die Raw/Normalized-Trennung mit deterministischen Stubs an.

export interface NormalizedMetricInput {
  metric: string;
  entityType: string;
  entityId: string;
  value: number;
  measuredAt: string;
}

export interface ConnectorFetchResult {
  payload: unknown;
  quotaRemaining: number | null;
  freshness: string;
}

export interface ConnectorContext {
  projectId: string;
  integrationId: string;
  now: string;
  entityType: string;
  entityId: string;
}

export interface Connector {
  readonly provider: IntegrationProvider;
  readonly sourceType: string;
  readonly sourceConfidence: SourceConfidence;
  fetch(ctx: ConnectorContext): ConnectorFetchResult;
  validate(payload: unknown): void;
  normalize(payload: unknown, ctx: ConnectorContext): NormalizedMetricInput[];
}

interface MetricRow {
  metric: string;
  value: number;
}

function rowsPayload(payload: unknown): MetricRow[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { rows?: unknown }).rows)) {
    throw new Error("connector payload is missing a rows array");
  }
  return (payload as { rows: MetricRow[] }).rows;
}

function metricConnector(options: {
  provider: IntegrationProvider;
  sourceType: string;
  sourceConfidence: SourceConfidence;
  rows: MetricRow[];
  prefix: string;
  quotaRemaining: number | null;
}): Connector {
  return {
    provider: options.provider,
    sourceType: options.sourceType,
    sourceConfidence: options.sourceConfidence,
    fetch(ctx) {
      return { payload: { rows: options.rows }, quotaRemaining: options.quotaRemaining, freshness: ctx.now };
    },
    validate(payload) {
      const rows = rowsPayload(payload);
      for (const row of rows) {
        if (typeof row.metric !== "string" || typeof row.value !== "number" || !Number.isFinite(row.value)) {
          throw new Error(`invalid metric row for ${options.provider}`);
        }
      }
    },
    normalize(payload, ctx) {
      return rowsPayload(payload).map((row) => ({
        metric: `${options.prefix}_${row.metric}`,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        value: row.value,
        measuredAt: ctx.now
      }));
    }
  };
}

// Deterministische Stub-Connectoren (Klasse B). Echte Provider-Adapter ersetzen nur fetch().
const gscConnector = metricConnector({
  provider: "gsc",
  sourceType: "search_console",
  sourceConfidence: "B",
  prefix: "gsc",
  quotaRemaining: 1000,
  rows: [
    { metric: "clicks", value: 1280 },
    { metric: "impressions", value: 45210 },
    { metric: "ctr", value: 0.0283 },
    { metric: "position", value: 12.4 }
  ]
});

const ga4Connector = metricConnector({
  provider: "ga4",
  sourceType: "analytics",
  sourceConfidence: "B",
  prefix: "ga4",
  quotaRemaining: 5000,
  rows: [
    { metric: "sessions", value: 3120 },
    { metric: "users", value: 2480 },
    { metric: "engagement_rate", value: 0.612 }
  ]
});

const pagespeedConnector = metricConnector({
  provider: "pagespeed",
  sourceType: "pagespeed_insights",
  sourceConfidence: "B",
  prefix: "psi",
  quotaRemaining: 250,
  rows: [
    { metric: "lcp_ms", value: 2410 },
    { metric: "cls", value: 0.04 },
    { metric: "inp_ms", value: 180 },
    { metric: "ttfb_ms", value: 320 }
  ]
});

const registry: Partial<Record<IntegrationProvider, Connector>> = {
  gsc: gscConnector,
  ga4: ga4Connector,
  pagespeed: pagespeedConnector
};

export function getConnector(provider: IntegrationProvider): Connector | null {
  return registry[provider] ?? null;
}

export function supportedConnectorProviders(): IntegrationProvider[] {
  return Object.keys(registry) as IntegrationProvider[];
}
