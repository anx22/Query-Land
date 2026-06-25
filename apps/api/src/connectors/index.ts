import type { IntegrationProvider, SourceConfidence } from "@seo-tool/domain-model";

// Connector-Vertrag gemäß specs/integrations.md (§4.2): source_type, auth_config (am
// integration_account), fetch, validate, normalize sowie quota_status/freshness (pro Lauf
// im Fetch-Ergebnis). Welle 1 verbindet noch keine produktiven OAuth-Flows, sondern legt
// Vertrag, Confidence-Tagging und die Raw/Normalized-Trennung mit deterministischen Stubs an.
//
// T5 "Connector-Verträge": jeder Connector meldet zusätzlich einen typisierten Status
// (describe) mit authStatus/quota/freshness/capabilities, und fetch() macht den
// Credential-Gate explizit, damit fehlende Credentials einen sichtbaren, abfragbaren
// degraded/blocked-Zustand erzeugen statt opak zu crashen.
//
// Stub -> Real-Seam: Echte Provider-Adapter ersetzen NUR fetch() durch den realen
// Netzwerk-Call. Der Rest des Vertrags (Auth-Gate, Quota, Freshness, Capabilities) bleibt
// unverändert. Solange keine echten Credentials hinterlegt sind, liefern die Stubs
// deterministische Werte bzw. melden "missing_credentials".

export interface NormalizedMetricInput {
  metric: string;
  entityType: string;
  entityId: string;
  value: number;
  measuredAt: string;
}

/** Auth-/Verfügbarkeitsstatus eines Connectors. */
export type ConnectorAuthStatus = "connected" | "missing_credentials" | "expired" | "degraded";

/** Maschinenlesbares Ergebnis eines Fetch-Versuchs inkl. Fehlermodi. */
export type ConnectorFetchOutcome =
  | "ok"
  | "missing_credentials"
  | "quota_exceeded"
  | "expired"
  | "degraded";

export interface ConnectorQuota {
  used: number;
  limit: number;
  resetsAt?: string;
}

export interface ConnectorFreshness {
  /** Zeitpunkt des letzten erfolgreichen Syncs (ISO) bzw. null, wenn nie. */
  lastSyncedAt: string | null;
  /** Zeitpunkt des letzten gelieferten Evidenz-/Rohdatensatzes (ISO) bzw. null. */
  lastEvidenceAt: string | null;
}

/**
 * Typisierter Connector-Vertrag, den jeder Connector über describe() meldet. UI/Agent
 * lesen daraus Auth-Status, Quota, Freshness und Fähigkeiten.
 */
export interface ConnectorContract {
  provider: IntegrationProvider;
  sourceType: string;
  sourceConfidence: SourceConfidence;
  authStatus: ConnectorAuthStatus;
  quota: ConnectorQuota | null;
  freshness: ConnectorFreshness;
  capabilities: string[];
}

/**
 * Typisiertes Fetch-Ergebnis. outcome === "ok" => payload ist gesetzt. Bei Fehlermodi
 * (missing_credentials/quota_exceeded/...) ist payload null und reason erklärt den Zustand
 * menschenlesbar, ohne dass der Aufrufer eine Exception fangen muss.
 */
export interface ConnectorFetchResult {
  outcome: ConnectorFetchOutcome;
  payload: unknown;
  quotaRemaining: number | null;
  quota: ConnectorQuota | null;
  freshness: string;
  reason?: string;
}

export interface ConnectorContext {
  projectId: string;
  integrationId: string;
  now: string;
  entityType: string;
  entityId: string;
  /** Ob am integration_account verwendbare Credentials (auth_config) hinterlegt sind. */
  hasCredentials: boolean;
}

/** Read-only Statuskontext, den describe() braucht (ohne Entity-Bezug). */
export interface ConnectorStatusContext {
  hasCredentials: boolean;
  lastSyncedAt: string | null;
  lastEvidenceAt: string | null;
}

export interface Connector {
  readonly provider: IntegrationProvider;
  readonly sourceType: string;
  readonly sourceConfidence: SourceConfidence;
  readonly capabilities: string[];
  /** Typisierter Vertrag/Status für UI/Agent (auth/quota/freshness/capabilities). */
  describe(ctx: ConnectorStatusContext): ConnectorContract;
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
  capabilities: string[];
  /** Deterministische Stub-Quota (used/limit). */
  quota: ConnectorQuota;
}): Connector {
  return {
    provider: options.provider,
    sourceType: options.sourceType,
    sourceConfidence: options.sourceConfidence,
    capabilities: options.capabilities,
    describe(ctx) {
      const authStatus: ConnectorAuthStatus = ctx.hasCredentials ? "connected" : "missing_credentials";
      return {
        provider: options.provider,
        sourceType: options.sourceType,
        sourceConfidence: options.sourceConfidence,
        authStatus,
        // Quota ist erst nach Verbindung aussagekräftig; ohne Credentials kein Verbrauch.
        quota: ctx.hasCredentials ? { ...options.quota } : { used: 0, limit: options.quota.limit },
        freshness: { lastSyncedAt: ctx.lastSyncedAt, lastEvidenceAt: ctx.lastEvidenceAt },
        capabilities: options.capabilities
      };
    },
    fetch(ctx) {
      // Credential-Gate: ohne hinterlegte auth_config gibt es keinen (realen) Call. Der
      // Stub macht das explizit sichtbar statt zu crashen. Echte Adapter ersetzen den
      // ok-Zweig durch den Netzwerk-Call; der missing_credentials-Zweig bleibt gleich.
      if (!ctx.hasCredentials) {
        return {
          outcome: "missing_credentials",
          payload: null,
          quotaRemaining: null,
          quota: null,
          freshness: ctx.now,
          reason: `${options.provider} has no credentials configured (auth_config is empty)`
        };
      }
      return {
        outcome: "ok",
        payload: { rows: options.rows },
        quotaRemaining: Math.max(options.quota.limit - options.quota.used, 0),
        quota: { ...options.quota },
        freshness: ctx.now
      };
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
  capabilities: ["search_analytics", "clicks", "impressions", "ctr", "position"],
  quota: { used: 200, limit: 1200 },
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
  capabilities: ["sessions", "users", "engagement"],
  quota: { used: 1000, limit: 6000 },
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
  capabilities: ["web_vitals", "lcp", "cls", "inp", "ttfb"],
  quota: { used: 50, limit: 300 },
  rows: [
    { metric: "lcp_ms", value: 2410 },
    { metric: "cls", value: 0.04 },
    { metric: "inp_ms", value: 180 },
    { metric: "ttfb_ms", value: 320 }
  ]
});

// T5: Lighthouse-Stub registrieren, damit getConnector("lighthouse") einen funktionierenden,
// zu GSC/PSI konsistenten Stub liefert (zuvor Typ/Enum-only und nicht registriert).
const lighthouseConnector = metricConnector({
  provider: "lighthouse",
  sourceType: "lighthouse",
  sourceConfidence: "A",
  prefix: "lh",
  capabilities: ["performance", "accessibility", "best_practices", "seo"],
  quota: { used: 5, limit: 100 },
  rows: [
    { metric: "performance", value: 0.92 },
    { metric: "accessibility", value: 0.97 },
    { metric: "best_practices", value: 0.95 },
    { metric: "seo", value: 1.0 }
  ]
});

const registry: Partial<Record<IntegrationProvider, Connector>> = {
  gsc: gscConnector,
  ga4: ga4Connector,
  pagespeed: pagespeedConnector,
  lighthouse: lighthouseConnector
};

export function getConnector(provider: IntegrationProvider): Connector | null {
  return registry[provider] ?? null;
}

export function supportedConnectorProviders(): IntegrationProvider[] {
  return Object.keys(registry) as IntegrationProvider[];
}
