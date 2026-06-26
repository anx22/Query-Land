import { NextResponse, type NextRequest } from "next/server";
import { GSC_AUTH_ENDPOINT, GSC_OAUTH_SCOPE, encryptJson, oauthEncryptionConfigured } from "@seo-tool/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Start the Google Search Console OAuth flow. Encodes the active project into a tamper-proof,
 * encrypted `state` (also serving as CSRF protection) and redirects to Google's consent screen.
 * `access_type=offline` + `prompt=consent` ensure a refresh token is returned.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const settings = new URL("/settings", request.nextUrl.origin);
  const projectId = request.nextUrl.searchParams.get("projectId");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!projectId) {
    settings.searchParams.set("error", "Kein Projekt angegeben.");
    return NextResponse.redirect(settings);
  }
  if (!clientId || !redirectUri || !oauthEncryptionConfigured()) {
    settings.searchParams.set("error", "Google-Verbindung ist serverseitig noch nicht konfiguriert.");
    return NextResponse.redirect(settings);
  }

  const state = encryptJson({ projectId, provider: "gsc", ts: Date.now() });
  const auth = new URL(GSC_AUTH_ENDPOINT);
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", GSC_OAUTH_SCOPE);
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("include_granted_scopes", "true");
  auth.searchParams.set("state", state);
  return NextResponse.redirect(auth);
}
