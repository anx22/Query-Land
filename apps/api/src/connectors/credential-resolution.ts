/**
 * credential-resolution.ts — small, testable helper that decides, per provider, whether
 * REAL credentials/config are present for a live network call.
 *
 * "Real" means one of:
 *   - an access token / API key passed through the integration's auth_config (decrypted), OR
 *   - the provider's env var (GSC_ACCESS_TOKEN / PAGESPEED_API_KEY).
 *
 * This is intentionally separate from the `hasCredentials` gate (which only checks that
 * auth_config is non-empty, e.g. the stub `{ stub: true }`). A stub integration has
 * `hasCredentials === true` but NO real provider secret — so the adapter still falls back
 * to the deterministic stub. Without any real secret, behavior is byte-for-byte unchanged.
 *
 * Never log token/key values.
 */
import type { IntegrationProvider } from "@seo-tool/domain-model";

/** Environment lookup, injectable so tests stay deterministic (no real process.env reads). */
export type EnvSource = Record<string, string | undefined>;

/** Resolved real credentials for a provider, or null when only a stub / nothing is configured. */
export interface ResolvedGscCredentials {
  kind: "gsc";
  accessToken: string;
  /** GSC property to query (e.g. "sc-domain:example.com" or a site URL). */
  property: string | null;
}

export interface ResolvedPsiCredentials {
  kind: "psi";
  apiKey: string;
}

export type ResolvedCredentials = ResolvedGscCredentials | ResolvedPsiCredentials;

/** Shape of a decrypted GSC auth_config (best-effort; fields optional). */
interface AuthConfigShape {
  accessToken?: unknown;
  property?: unknown;
  apiKey?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Resolve real GSC credentials. Prefers the integration's decrypted auth_config access token,
 * falls back to GSC_ACCESS_TOKEN. Returns null when neither is present (=> stub fallback).
 */
export function resolveGscCredentials(authConfig: unknown, env: EnvSource): ResolvedGscCredentials | null {
  const cfg = (authConfig && typeof authConfig === "object" ? authConfig : {}) as AuthConfigShape;
  const accessToken = asString(cfg.accessToken) ?? asString(env.GSC_ACCESS_TOKEN);
  if (!accessToken) return null;
  const property = asString(cfg.property) ?? asString(env.GSC_PROPERTY);
  return { kind: "gsc", accessToken, property };
}

/**
 * Resolve a real PageSpeed (PSI) API key. PSI uses an API key (not OAuth); the key comes from
 * the PAGESPEED_API_KEY env var or, if present, the integration auth_config.apiKey.
 */
export function resolvePsiCredentials(authConfig: unknown, env: EnvSource): ResolvedPsiCredentials | null {
  const cfg = (authConfig && typeof authConfig === "object" ? authConfig : {}) as AuthConfigShape;
  const apiKey = asString(cfg.apiKey) ?? asString(env.PAGESPEED_API_KEY);
  if (!apiKey) return null;
  return { kind: "psi", apiKey };
}

/**
 * Whether REAL credentials are configured for a provider (drives the live path + a more
 * accurate authStatus). Falls back to false for providers without a real adapter.
 */
export function hasRealCredentials(provider: IntegrationProvider, authConfig: unknown, env: EnvSource): boolean {
  switch (provider) {
    case "gsc":
      return resolveGscCredentials(authConfig, env) !== null;
    case "pagespeed":
    case "lighthouse":
      // Lighthouse is derived from the PSI response, so it shares PSI's key.
      return resolvePsiCredentials(authConfig, env) !== null;
    default:
      return false;
  }
}
