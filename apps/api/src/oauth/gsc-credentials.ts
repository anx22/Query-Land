/**
 * gsc-credentials.ts — resolve a project's stored Google Search Console OAuth credentials and keep
 * the access token fresh, so the data stores can build a real GSC-backed provider on demand.
 *
 * The credentials live (AES-GCM encrypted) in integration_accounts.auth_config for provider='gsc'
 * with status='connected'. When anything is missing (no integration, not connected, legacy stub,
 * no encryption key, no OAuth client env) the resolver returns null and the caller falls back to the
 * empty provider — i.e. an honest empty state, never a crash.
 */
import type { AsyncDatabase } from "../db/index.js";
import { createGscClient, type GscClient, GscApiError, type GscTokens } from "./gsc-client.js";
import { decryptJson, encryptJson, oauthEncryptionConfigured } from "./token-crypto.js";

export interface GscAuthConfig {
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp when the access token expires. */
  expiresAt: string;
  /** The verified GSC property to query, e.g. "sc-domain:example.com". */
  property: string;
}

/** Refresh slightly before expiry to avoid racing a 401. */
const EXPIRY_SKEW_MS = 60_000;

// Test seam: override how the GSC client is constructed so store-integration tests can inject a mock.
let clientFactoryOverride: (() => GscClient | null) | null = null;
export function __setGscClientFactoryForTests(factory: (() => GscClient | null) | null): void {
  clientFactoryOverride = factory;
}

/** Build a GSC client from the GOOGLE_CLIENT_ID/SECRET env vars, or null when unconfigured. */
export function gscClientFromEnv(): GscClient | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return createGscClient({ clientId, clientSecret });
}

function buildClient(): GscClient | null {
  return clientFactoryOverride ? clientFactoryOverride() : gscClientFromEnv();
}

function isUsableAuthConfig(value: unknown): value is GscAuthConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.accessToken === "string" && typeof c.refreshToken === "string" && typeof c.property === "string" && typeof c.expiresAt === "string";
}

/**
 * Load the decrypted, connected Google OAuth credentials for a project + provider, or null when not
 * connectable. GA4 shares the exact auth_config shape (access/refresh token + expiry + property),
 * so the same loader/refresher serve both — only the provider row differs.
 */
export async function loadActiveGscCredentials(db: AsyncDatabase, projectId: string, provider: "gsc" | "ga4" = "gsc"): Promise<GscAuthConfig | null> {
  if (!oauthEncryptionConfigured()) return null;
  const row = (await db
    .prepare(`SELECT auth_config, status FROM integration_accounts WHERE project_id = ? AND provider = ?`)
    .get(projectId, provider)) as { auth_config?: string; status?: string } | undefined;
  if (!row || row.status !== "connected" || !row.auth_config) return null;
  try {
    const decrypted = decryptJson<unknown>(row.auth_config);
    return isUsableAuthConfig(decrypted) ? decrypted : null;
  } catch {
    return null; // legacy stub / tampered / wrong key
  }
}

/**
 * Ensure the access token is valid, refreshing + persisting it when near expiry. On an auth failure
 * (revoked/invalid refresh token) the integration is marked 'error' and null is returned.
 */
export async function ensureFreshToken(
  db: AsyncDatabase,
  projectId: string,
  client: GscClient,
  creds: GscAuthConfig,
  provider: "gsc" | "ga4" = "gsc",
): Promise<GscAuthConfig | null> {
  const expired = Date.parse(creds.expiresAt) - EXPIRY_SKEW_MS <= Date.now();
  if (!expired) return creds;
  try {
    const refreshed: GscTokens = await client.refreshAccessToken(creds.refreshToken);
    const next: GscAuthConfig = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? creds.refreshToken, // Google may omit a new one
      expiresAt: refreshed.expiresAt,
      property: creds.property,
    };
    await db
      .prepare(`UPDATE integration_accounts SET auth_config = ?, status = 'connected', updated_at = ? WHERE project_id = ? AND provider = ?`)
      .run(encryptJson(next), new Date().toISOString(), projectId, provider);
    return next;
  } catch (error) {
    if (error instanceof GscApiError && error.isAuthError) {
      await db
        .prepare(`UPDATE integration_accounts SET status = 'error', updated_at = ? WHERE project_id = ? AND provider = ?`)
        .run(new Date().toISOString(), projectId, provider);
    }
    return null;
  }
}

export interface GscAdapterContext {
  client: GscClient;
  creds: GscAuthConfig;
}

/**
 * Resolve a ready-to-query Google adapter context (client + fresh, persisted creds) for a project +
 * provider, or null to fall back to the honest empty state. Works for both GSC and GA4 (same client).
 */
export async function resolveGscAdapterContext(db: AsyncDatabase, projectId: string, provider: "gsc" | "ga4" = "gsc"): Promise<GscAdapterContext | null> {
  const client = buildClient();
  if (!client) return null;
  const creds = await loadActiveGscCredentials(db, projectId, provider);
  if (!creds) return null;
  const fresh = await ensureFreshToken(db, projectId, client, creds, provider);
  if (!fresh) return null;
  return { client, creds: fresh };
}

/** GSC search-analytics date window: last 28 full days, ending 3 days back (GSC data latency). */
export function searchAnalyticsWindow(now: Date = new Date()): { startDate: string; endDate: string } {
  const day = 24 * 60 * 60 * 1000;
  const end = new Date(now.getTime() - 3 * day);
  const start = new Date(end.getTime() - 27 * day);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}
