# Plan 007 — Tests für Next.js Route-Handler

- **Kategorie:** Test Coverage · **Aufwand:** M · **Risiko:** MED · **Hängt ab von:** 002 (CI), 004 (Scoping)
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

Es gibt **null** Tests für die Next.js Route-Handler unter `apps/web/src/app/api/*`, obwohl dort
sicherheitskritische Logik liegt: Cron-Trigger (Secret-Prüfung), OAuth-Callback (CSRF-State,
Token-Tausch, verschlüsselte Speicherung), Export-Proxy. Bugs in Secret-Validierung oder
State-Verifikation erreichen sonst ungetestet die Produktion.

Priorität nach Sicherheitsrelevanz:
1. `apps/web/src/app/api/oauth/google/callback/route.ts` (`GET`, Zeile 14–67) — verifiziert
   `verifyOAuthState`, liest `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, tauscht Code→Tokens, prüft
   Refresh-Token-Pflicht, ruft `POST /integrations/credentials`. **Loggt nie Tokens** — im Test bewahren.
2. `apps/web/src/app/api/cron/crawl/route.ts` (`GET`, Zeile 22–53) — `Authorization: Bearer <CRON_SECRET>`
   (401 bei fehlend/falsch), `VERCEL` gesetzt ohne Secret → 503 `cron_not_configured`, sonst Drain +
   200-Aggregat.
3. `apps/web/src/app/api/export/[...path]/route.ts` (`GET`, Zeile 14–40) — Proxy via `callInternalApi`,
   Content-Disposition-Header, 502 bei fehlendem Content.

## Gewählter Ansatz (Vitest + jsdom)

Bestehende Web-Test-Infrastruktur nutzen: `apps/web/vitest.config.ts` (`environment: "jsdom"`,
`globals: true`, `setupFiles: ["./vitest.setup.ts"]`, include-Glob `src/**/*.test.{ts,tsx}`). Mocking-
Muster: `apps/web/src/lib/dossier-api.test.ts`. Neue Tests unter `apps/web/src/app/api/**/route.test.ts`.

- **Isolation per `vi.mock(...)`:** `callInternalApi` (aus `../../../../lib/server-api`), die Cron-Helfer
  (`drainCrawlJobs`, `enqueueDueConnectorSyncs`, `drainConnectorSyncJobs`, `runDueReportSchedules`) und
  die `@seo-tool/api`-Importe (`verifyOAuthState`, `createGscClient`, `encryptJson`,
  `oauthEncryptionConfigured`) mocken — **keine** echte API/DB, kein Netzwerk.
- **Env-Vars** pro Test über `vi.stubEnv(...)` setzen/zurücksetzen (`CRON_SECRET`, `GOOGLE_*`, `VERCEL`).
- **Request-Objekte:** `new NextRequest(new URL("http://localhost/api/..."))`; Header via
  `new Headers(...)`. Für `export/[...path]` den `context.params`-Promise (Next 15) als
  `{ params: Promise.resolve({ path: [...] }) }` übergeben.

Testfälle (mind. Happy-Path + 2 Fehlerpfade je Handler):
- **OAuth-Callback:** gültiger State + Code → `callInternalApi("POST", "/integrations/credentials", …)`
  mit erwartetem Body (projectId, provider, property, Token-Felder aus dem gemockten Exchange);
  ungültiger/fehlender State → Redirect `/settings?error=…`, **kein** Credentials-Call; fehlendes
  Refresh-Token → Fehler-Redirect. **Nie echte Tokens** in Fixtures — Platzhalter-Strings.
- **Cron:** fehlender/falscher `Authorization`-Header → 401; `VERCEL=1` ohne `CRON_SECRET` → 503; gültiger
  Bearer → 200 mit Aggregat (gemockte Drain-Helfer geben Zähl-Stubs zurück, Handler aggregiert korrekt).
- **Export:** gültiger Pfad → proxied Response mit `Content-Disposition`; fehlender Content → 502.

## Scope

- **In scope:** nur neue `*.test.ts` unter `apps/web/src/app/api/`.
- **Explizit out of scope:** Produktivcode der Handler (dieser Plan testet nur; Bugs, die dabei
  auffallen, als Finding melden, nicht heimlich fixen); echte Integrationstests gegen laufende API/DB.
- **Reihenfolge:** nach Plan **004** schreiben (damit ein evtl. Integrations-bezogener Test das neue
  Scoping-Verhalten abbildet) und nach **002** (die CI führt die neuen Tests aus).

## Verifikation (Done-Kriterien)

1. `npm --workspace @seo-tool/web run test` grün; die drei Handler haben je ≥ 3 Fälle (Happy + 2 Fehler).
2. Kein Handler-Produktivcode im Diff (nur `*.test.ts`).
3. Kein echter Token-/Secret-String in den Tests (grep die neuen Dateien).
4. Auf CI (Plan 002) laufen die Tests mit.

## Test-Plan

Die neuen Tests **sind** das Deliverable. Als Selbstkontrolle: einen Test bewusst kurz „rot" machen
(z. B. falsche erwartete Status-Zahl) um zu bestätigen, dass er echt gegen den Handler prüft, dann
zurückdrehen.

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Nutzt ein Handler serverseitige Next-Internals, die sich in jsdom nicht sinnvoll
  mocken lassen (z. B. `next/headers`/`cookies()` in ungewöhnlicher Form), diesen Handler als
  „integration-test-only" markieren und melden statt den Test zu erzwingen — die anderen trotzdem liefern.
- `authorize/route.ts` und `foundation/route.ts` sind niedrigere Priorität; abdecken, wenn die drei
  Kern-Handler stehen.
- Beim späteren Umbau eines Handlers die zugehörigen Mocks mitpflegen (die Test-Mocks koppeln an die
  Import-Pfade der Helfer).
