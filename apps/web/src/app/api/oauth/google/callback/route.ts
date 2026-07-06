import { NextResponse, type NextRequest } from "next/server";
import { createGscClient } from "@seo-tool/api";
import { callInternalApi } from "../../../../../lib/server-api";
import { runGscRefreshForProject } from "../../../../../lib/gsc-refresh";
import { hostOf, matchGscProperty, verifyOAuthState, type GscPropertyEntry } from "../../../../../lib/oauth-google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The immediate post-connect refresh does real GSC fetches; give the handler room like the cron.
export const maxDuration = 60;

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

    // GA4: the numeric property id is chosen by the user up front (GA4 has no host to auto-match),
    // so store the credentials with that property and let the connector sync fetch analytics data.
    if (state.provider === "ga4") {
      if (!state.propertyId) return fail("Keine GA4-Property-ID im Anmelde-Vorgang. Bitte erneut verbinden.");
      const upsert = await callInternalApi("POST", "/integrations/credentials", {
        projectId: state.projectId,
        provider: "ga4",
        property: state.propertyId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      });
      if (upsert.status >= 400) return fail("Die GA4-Verbindung konnte nicht gespeichert werden.");
      settings.searchParams.set("connected", "ga4");
      return NextResponse.redirect(settings);
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

    // Immediate first refresh so data shows up right after connecting. Best effort + light (URL
    // inspection is left to the cron/button so this redirect handler can't time out); a failure here
    // never blocks the redirect — the daily cron and the "Jetzt synchronisieren" button retry.
    try {
      await runGscRefreshForProject(callInternalApi, state.projectId, { skipUrlInspection: true });
    } catch {
      // ignore — data will fill on the next scheduled/manual refresh
    }

    settings.searchParams.set("connected", "gsc");
    return NextResponse.redirect(settings);
  } catch {
    return fail("Die Verbindung zu Google ist fehlgeschlagen. Bitte erneut versuchen.");
  }
}
