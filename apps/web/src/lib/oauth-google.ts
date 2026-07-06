/**
 * Pure helpers for the Google Search Console OAuth flow (state verification + property matching),
 * kept separate from the route handlers so they can be unit-tested without HTTP.
 */
import { decryptJson } from "@seo-tool/api";

/** OAuth `state` is only valid for a short window. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthState {
  projectId: string;
  provider: string;
  /** GA4 numeric property id carried through the flow (null for GSC, which auto-matches by host). */
  propertyId: string | null;
  ts: number;
}

/** Decrypt + validate the OAuth `state`. Returns null on tamper, wrong shape, or expiry. */
export function verifyOAuthState(stateRaw: string | null, now: number = Date.now()): OAuthState | null {
  if (!stateRaw) return null;
  let decoded: unknown;
  try {
    decoded = decryptJson(stateRaw);
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object") return null;
  const s = decoded as Record<string, unknown>;
  if (typeof s.projectId !== "string" || typeof s.provider !== "string" || typeof s.ts !== "number") return null;
  if (now - s.ts > OAUTH_STATE_TTL_MS || s.ts > now + 60_000) return null;
  return { projectId: s.projectId, provider: s.provider, propertyId: typeof s.propertyId === "string" ? s.propertyId : null, ts: s.ts };
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export interface GscPropertyEntry {
  siteUrl: string;
  permissionLevel: string;
}

/**
 * Pick the verified GSC property for a site host: prefer a `sc-domain:` property, then a URL-prefix
 * property whose host matches. Unverified properties are ignored. Returns null when none match.
 */
export function matchGscProperty(sites: GscPropertyEntry[], host: string | null): string | null {
  if (!host) return null;
  const usable = sites.filter((s) => s.permissionLevel !== "siteUnverifiedUser");
  const domainProp = usable.find((s) => s.siteUrl.toLowerCase() === `sc-domain:${host}`);
  if (domainProp) return domainProp.siteUrl;
  const urlProp = usable.find((s) => hostOf(s.siteUrl) === host);
  return urlProp?.siteUrl ?? null;
}
