import { NextResponse, type NextRequest } from "next/server";
import { GSC_AUTH_ENDPOINT, GSC_OAUTH_SCOPE, GA4_OAUTH_SCOPE, encryptJson, oauthEncryptionConfigured } from "@seo-tool/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Start a Google OAuth flow for a provider (gsc | ga4). Both share the same Google OAuth client;
 * only the requested scope differs. Encodes the active project (+ for GA4 the numeric property id)
 * into a tamper-proof, encrypted `state` (also CSRF protection) and redirects to Google's consent
 * screen. `access_type=offline` + `prompt=consent` ensure a refresh token is returned.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const settings = new URL("/settings", request.nextUrl.origin);
  const projectId = request.nextUrl.searchParams.get("projectId");
  const provider = request.nextUrl.searchParams.get("provider") === "ga4" ? "ga4" : "gsc";
  const propertyId = request.nextUrl.searchParams.get("propertyId")?.trim() || null;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!projectId) {
    settings.searchParams.set("error", "Kein Projekt angegeben.");
    return NextResponse.redirect(settings);
  }
  if (provider === "ga4" && !propertyId) {
    settings.searchParams.set("error", "Bitte eine GA4-Property-ID angeben, bevor Sie verbinden.");
    return NextResponse.redirect(settings);
  }
  if (!clientId || !redirectUri || !oauthEncryptionConfigured()) {
    settings.searchParams.set("error", "Google-Verbindung ist serverseitig noch nicht konfiguriert.");
    return NextResponse.redirect(settings);
  }

  const state = encryptJson({ projectId, provider, propertyId, ts: Date.now() });
  const auth = new URL(GSC_AUTH_ENDPOINT);
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", provider === "ga4" ? GA4_OAUTH_SCOPE : GSC_OAUTH_SCOPE);
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("include_granted_scopes", "true");
  auth.searchParams.set("state", state);
  return NextResponse.redirect(auth);
}
