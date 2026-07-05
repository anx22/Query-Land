import type { IntegrationProvider, SourceConfidence } from "@seo-tool/domain-model";
import {
  resolveGscCredentials,
  resolvePsiCredentials,
  hasRealCredentials,
  type EnvSource
} from "./credential-resolution.js";
import { fetchGscLive, fetchPsiLive, type FetchImpl } from "./adapters.js";

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
//
// B3 "Real adapters": fetch() ist jetzt async. Wenn echte Credentials/Env vorhanden sind
// (GSC access token, PAGESPEED_API_KEY), macht der jeweilige Adapter einen echten HTTPS-Call
// und mappt auf dieselben normalisierten Rows; Netzwerk-/Quota-/Auth-Fehler werden als
// typisierte degraded/quota_exceeded/expired-Outcomes zurückgegeben (nie geworfen). Ohne echte
// Credentials bleibt das Verhalten byte-für-byte gleich (Stub bzw. missing_credentials).

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
  /**
   * Entschlüsselte auth_config der Integration (kann access token / property / apiKey tragen).
   * Wird nur vom realen Adapter gelesen; undefined => kein realer Call, Stub-Fallback.
   */
  authConfig?: unknown;
  /** Ziel-URL für PSI/Lighthouse (z. B. base_url der Site). */
  siteUrl?: string | null;
  /** Injizierbare fetch-Implementierung (Default: globalThis.fetch) für Tests/Proxy. */
  fetchImpl?: FetchImpl;
  /** Injizierbare Env-Quelle (Default: process.env) für deterministische Tests. */
  env?: EnvSource;
}

/** Read-only Statuskontext, den describe() braucht (ohne Entity-Bezug). */
export interface ConnectorStatusContext {
  hasCredentials: boolean;
  lastSyncedAt: string | null;
  lastEvidenceAt: string | null;
  /** Entschlüsselte auth_config — damit describe() echte vs. Stub-Credentials unterscheiden kann. */
  authConfig?: unknown;
  /** Injizierbare Env-Quelle (Default: process.env). */
  env?: EnvSource;
}

export interface Connector {
  readonly provider: IntegrationProvider;
  readonly sourceType: string;
  readonly sourceConfidence: SourceConfidence;
  readonly capabilities: string[];
  /** Typisierter Vertrag/Status für UI/Agent (auth/quota/freshness/capabilities). */
  describe(ctx: ConnectorStatusContext): ConnectorContract;
  fetch(ctx: ConnectorContext): Promise<ConnectorFetchResult>;
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

/** Real-adapter hook: returns a typed result for the live network path, or null to use the stub. */
type LiveFetch = (ctx: ConnectorContext) => Promise<ConnectorFetchResult> | null;

function defaultEnv(ctx: { env?: EnvSource }): EnvSource {
  return ctx.env ?? (process.env as EnvSource);
}

/**
 * §2.7-Firewall: synthetische Stub-Werte dürfen NIE als echte (Klasse-A/B-)Evidenz gelten.
 * Im Produktpfad liefert ein Connector ohne real aufgelöste Credentials daher `missing_credentials`
 * (ehrlicher Leerzustand) statt fabrizierter Rows. Die deterministischen Stub-Rows sind nur für
 * Entwicklung/Demo/Tests gedacht und werden ausschließlich freigeschaltet, wenn
 * `SEO_ALLOW_STUB_CONNECTORS=1` explizit gesetzt ist (Default: aus → Produktion fälscht nie).
 */
function stubDataAllowed(env: EnvSource): boolean {
  return env.SEO_ALLOW_STUB_CONNECTORS === "1";
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
  /**
   * Optionaler realer Adapter. Wird nur aufgerufen, wenn hasCredentials true ist. Liefert null,
   * wenn keine echten Provider-Credentials konfiguriert sind => Stub-Fallback (unverändert).
   */
  liveFetch?: LiveFetch;
}): Connector {
  return {
    provider: options.provider,
    sourceType: options.sourceType,
    sourceConfidence: options.sourceConfidence,
    capabilities: options.capabilities,
    describe(ctx) {
      // "connected" sobald irgendeine auth_config hinterlegt ist (Stub oder echt). Reale
      // Credentials (env/auth_config) heben den Status ebenfalls auf connected, selbst wenn die
      // gespeicherte auth_config leer ist — so spiegelt der Status die Realität wider.
      const realCreds = hasRealCredentials(options.provider, ctx.authConfig, defaultEnv(ctx));
      const authStatus: ConnectorAuthStatus =
        ctx.hasCredentials || realCreds ? "connected" : "missing_credentials";
      return {
        provider: options.provider,
        sourceType: options.sourceType,
        sourceConfidence: options.sourceConfidence,
        authStatus,
        // Quota ist erst nach Verbindung aussagekräftig; ohne Credentials kein Verbrauch.
        quota: authStatus === "connected" ? { ...options.quota } : { used: 0, limit: options.quota.limit },
        freshness: { lastSyncedAt: ctx.lastSyncedAt, lastEvidenceAt: ctx.lastEvidenceAt },
        capabilities: options.capabilities
      };
    },
    async fetch(ctx) {
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
      // Realer Adapter: nur wenn echte Provider-Credentials/Env aufgelöst werden konnten
      // (liveFetch !== null). Sonst kein realer Call.
      if (options.liveFetch) {
        const live = options.liveFetch(ctx);
        if (live) {
          return live;
        }
      }
      // Kein real aufgelöster Adapter. §2.7-Firewall: ohne echte Credentials KEINE synthetischen
      // Rows als Evidenz zurückgeben. Nur wenn Stub-Daten explizit erlaubt sind (Dev/Demo/Tests),
      // liefert der Connector die deterministischen Rows; sonst ehrlicher `missing_credentials`.
      if (!stubDataAllowed(defaultEnv(ctx))) {
        return {
          outcome: "missing_credentials",
          payload: null,
          quotaRemaining: null,
          quota: null,
          freshness: ctx.now,
          reason: `${options.provider} has no real provider credentials (auth_config carries no usable secret); synthetic stub data is disabled`
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
  ],
  liveFetch(ctx) {
    const creds = resolveGscCredentials(ctx.authConfig, ctx.env ?? (process.env as EnvSource));
    if (!creds) return null;
    return fetchGscLive(creds, {
      property: ctx.siteUrl ?? null,
      now: ctx.now,
      fetchImpl: ctx.fetchImpl ?? fetch
    });
  }
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
  ],
  liveFetch(ctx) {
    const creds = resolvePsiCredentials(ctx.authConfig, ctx.env ?? (process.env as EnvSource));
    if (!creds) return null;
    return fetchPsiLive(creds, {
      siteUrl: ctx.siteUrl ?? null,
      now: ctx.now,
      fetchImpl: ctx.fetchImpl ?? fetch,
      variant: "psi"
    });
  }
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
  ],
  liveFetch(ctx) {
    // Lighthouse-Daten kommen aus der PSI-Antwort (PSI liefert lighthouseResult), teilen also
    // den PSI-API-Key. Ohne Key => Stub.
    const creds = resolvePsiCredentials(ctx.authConfig, ctx.env ?? (process.env as EnvSource));
    if (!creds) return null;
    return fetchPsiLive(creds, {
      siteUrl: ctx.siteUrl ?? null,
      now: ctx.now,
      fetchImpl: ctx.fetchImpl ?? fetch,
      variant: "lighthouse"
    });
  }
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
