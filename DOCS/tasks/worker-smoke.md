# Worker Smoke — Crawler

Stand: 2026-06-25

## Ziel

Dieses Dokument macht den `crawl_seed`-Worker-Smoke reproduzierbar. Der Smoke belegt, dass der Worker Jobs claimt, Crawl-Artefakte persistiert, Crawl Runs abschließt und bei Sitemap-Index-/Redirect-/Robots-Edge-Cases erklärbar bleibt.

## Aktuelles Betriebsmodell

Es gibt **keinen** langlaufenden lokalen SQLite-Daemon (`start:once`) mehr. Produktiv läuft der Crawler als **in-process Vercel-Cron-Route** (`GET /api/cron/crawl`) gegen die **Neon-Postgres**-Datenbank:

- Vercel ruft die Route per Cron (siehe `vercel.json`) auf.
- Die Route ruft `drainCrawlJobs()` (`apps/web/src/lib/crawl-cron.ts`), das die `crawl_seed`-Queue innerhalb eines Job-/Zeit-Budgets leert.
- Jeder gedrainte Zyklus loggt eine strukturierte JSON-Zeile (`event: "crawl_drain_cycle"`) mit `jobId` + `crawlRunId` + Outcome zur Korrelation in den Vercel-Logs. Logs sind unter `NODE_ENV=test` unterdrückt.
- Auth: `CRON_SECRET` (`Authorization: Bearer <CRON_SECRET>`); ohne Secret ist die Route auf Vercel inert (503).

## Automatisierter Fixture-Smoke (deterministisch, CI)

Der Fixture-Smoke ist Teil von `npm run check` / `npm test` und läuft komplett lokal mit `sqlite::memory:` und einem deterministischen `fetchImpl` (kein Netzwerk).

```bash
npm test -- --test-name-pattern "crawl worker claims crawl_seed job and persists crawl artifacts end-to-end"
```

Er prüft:

1. `crawl_seed`-Job wird geclaimt.
2. Sitemap-URLs werden als `discovered_urls` persistiert.
3. Fetch Results, Indexability Assessments, Audit Issues und Health Score werden geschrieben.
4. Crawl Run wird mit Summary abgeschlossen.
5. Job endet `succeeded`.

Zusätzliche Härtungs-Smokes (alle deterministisch, kein Netzwerk):

```bash
npm test -- --test-name-pattern "sitemap index|redirect loop|network-error|robots-blocked|backoff|user-agent|robots groups"
```

Diese prüfen u. a.:

- Sitemap-Index-Auflösung nur für in-scope Sitemap-Dateien + Persistenz.
- Redirect-Loop-Erkennung vor Endloslauf (als `network_error`).
- Netzwerkfehler-Fetches bleiben erklärbar, der Run/Job wird ohne unhandled-Throw abgeschlossen.
- Robots-blockierte URLs werden ohne Page-Fetch als non-indexable erfasst.
- Robots multi-user-agent Gruppen-Akkumulation + spezifischste Gruppen-Selektion mit `*`-Fallback.
- Capped exponential Backoff (injizierte Clock, deterministische Delay-Sequenz).
- Gesendeter `User-Agent`-Header (Default + Override).

## Manueller Smoke gegen eine echte Test-Site

> Kein netzwerkabhängiger automatisierter Test — CI bleibt deterministisch. Diesen Smoke nur manuell ausführen.

### TARGET (Platzhalter)

Eine eigene, crawlbare Site mit gültiger `robots.txt` und `sitemap.xml` setzen:

```bash
export SMOKE_BASE_URL="https://deine-test-site.example/"
export SMOKE_SITEMAP_URL="https://deine-test-site.example/sitemap.xml"
export SMOKE_PROJECT_ID="proj-smoke"
export SMOKE_SITE_ID="site-smoke"
```

Empfehlung: eine kleine eigene Content-/Marketing-Site (wenige Dutzend URLs), bei der ihr Crawl-Berechtigung habt. Niemals fremde Sites ohne Erlaubnis crawlen — der Crawler sendet den User-Agent `SeoToolBot/1.0 (+https://github.com/seo-tool)` (überschreibbar via `CRAWLER_USER_AGENT`) und respektiert `robots.txt`.

### Voraussetzungen

1. Neon-Postgres erreichbar; `DATABASE_URL` / Neon-Connection-String gesetzt.
2. `CRON_SECRET` gesetzt (für die Cron-Route).
3. Web-App lokal gebaut/gestartet.

### Befehle (manuell)

```bash
# 1. Build
npm run build

# 2. Web-App lokal starten (lädt .env mit DATABASE_URL + CRON_SECRET)
npm run build:web && npm --workspace @seo-tool/web run start &

# 3. crawl_seed-Job über die interne API anlegen (Payload siehe unten)
curl -sS -X POST "http://localhost:3000/api/internal/jobs" \
  -H "content-type: application/json" \
  -d "{\"projectId\":\"$SMOKE_PROJECT_ID\",\"type\":\"crawl_seed\",\"subject\":\"$SMOKE_BASE_URL\",\"payload\":{\"siteId\":\"$SMOKE_SITE_ID\",\"baseUrl\":\"$SMOKE_BASE_URL\",\"sitemapUrl\":\"$SMOKE_SITEMAP_URL\"}}"

# 4. Cron-Route einmal triggern (drained die Queue)
curl -sS "http://localhost:3000/api/cron/crawl" \
  -H "authorization: Bearer $CRON_SECRET" | jq

# 5. Crawl-Run-Status / Artefakte prüfen
curl -sS "http://localhost:3000/api/internal/projects/$SMOKE_PROJECT_ID/sites/$SMOKE_SITE_ID/crawl-runs" | jq
```

Job-Payload:

```json
{
  "siteId": "site-smoke",
  "baseUrl": "https://deine-test-site.example/",
  "sitemapUrl": "https://deine-test-site.example/sitemap.xml"
}
```

> Hinweis: Die konkreten internen API-Pfade können je nach Routing variieren — maßgeblich ist, dass ein `crawl_seed`-Job angelegt und anschließend `/api/cron/crawl` mit gültigem `CRON_SECRET` aufgerufen wird.

## Erfolgskriterien (CRITERIA)

Der manuelle Site-Smoke gilt als bestanden, wenn:

- die Cron-Antwort `ok: true` liefert und `crawl.processed >= 1` ist,
- pro gedraintem Zyklus eine `crawl_drain_cycle`-Logzeile mit `jobId` + `crawlRunId` erscheint,
- der `crawl_seed`-Job `succeeded` ist (oder bei bewusstem Fehler nachvollziehbar `failed` mit `errorMessage`),
- ein Crawl Run mit Summary vorhanden ist (`discoveredUrls`, `fetchedUrls`, `healthScore !== null`),
- `discovered_urls`, Fetch Results und Indexability Assessments persistiert wurden,
- Sitemap-Index-Dateien nur in-scope verfolgt wurden,
- Redirect-Loops als erklärbarer `network_error` statt als Endloslauf sichtbar werden,
- robots-blockierte URLs als `blocked_by_robots` ohne Page-Fetch erfasst werden,
- die Requests den erwarteten `User-Agent` an die Zielsite gesendet haben.

## Einschränkungen

- Kein netzwerkabhängiger Test in CI — der echte Site-Smoke ist manuell.
- Vercel-Serverless ist statenlos; persistenter State liegt ausschließlich in Neon-Postgres.
- JS-Rendering, große Vollcrawls und externe Scheduler sind weiterhin außerhalb des Scopes.
```
