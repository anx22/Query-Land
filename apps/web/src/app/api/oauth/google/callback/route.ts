import { NextResponse, type NextRequest } from "next/server";
import { createGscClient } from "@seo-tool/api";
import { callInternalApi } from "../../../../../lib/server-api";
import { hostOf, matchGscProperty, verifyOAuthState, type GscPropertyEntry } from "../../../../../lib/oauth-google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Google Search Console OAuth callback. Verifies the CSRF state, exchanges the code for tokens,
 * picks the verified property matching the project's website, and stores the (encrypted) credentials
 * via the internal API. Never logs tokens. Always redirects back to /settings with a result.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const settings = new URL("/settings", request.nextUrl.origin);
  const fail = (message: string) => {
    settings.searchParams.set("error", message);
    return NextResponse.redirect(settings);
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("Google hat die Freigabe abgelehnt.");

  const code = params.get("code");
  const state = verifyOAuthState(params.get("state"));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!code) return fail("Ungültige Antwort von Google.");
  if (!state) return fail("Der Anmelde-Vorgang ist abgelaufen oder ungültig. Bitte erneut verbinden.");
  if (!clientId || !clientSecret || !redirectUri) return fail("Google-Verbindung ist serverseitig nicht konfiguriert.");

  try {
    const client = createGscClient({ clientId, clientSecret });
    const tokens = await client.exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refreshToken) {
      return fail("Kein dauerhafter Zugriff erhalten. Bitte den App-Zugriff im Google-Konto entfernen und erneut verbinden.");
    }

    const sites = await client.listSites(tokens.accessToken);
    const sitesResponse = await callInternalApi("GET", `/projects/${state.projectId}/sites`);
    const projectSites = ((sitesResponse.body as { data?: Array<{ baseUrl?: string }> } | undefined)?.data) ?? [];
    const host = hostOf(projectSites[0]?.baseUrl);
    if (!host) return fail("Dem Projekt ist noch keine Website zugeordnet.");

    const property = matchGscProperty(sites as GscPropertyEntry[], host);
    if (!property) {
      return fail(`In der Search Console wurde keine verifizierte Property für ${host} gefunden. Bitte die Website dort verifizieren.`);
    }

    const upsert = await callInternalApi("POST", "/integrations/credentials", {
      projectId: state.projectId,
      provider: "gsc",
      property,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
    if (upsert.status >= 400) return fail("Die Verbindung konnte nicht gespeichert werden.");

    settings.searchParams.set("connected", "gsc");
    return NextResponse.redirect(settings);
  } catch {
    return fail("Die Verbindung zu Google ist fehlgeschlagen. Bitte erneut versuchen.");
  }
}
