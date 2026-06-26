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

> Kein netzwerkabhängiger automatisierter Test — CI bleibt deterministisch. Der
> Runner ist ein **Script** (`services/crawler/src/smoke.ts`), kein `*.test.ts`,
> und wird daher von `npm test` / `npm run check` **nicht** ausgeführt. Diesen
> Smoke nur manuell ausführen.

### Sicherheit / Berechtigung

Niemals fremde Sites ohne Erlaubnis crawlen — nur Sites, die euch gehören bzw.
für die ihr Crawl-Berechtigung habt. Der Crawler sendet den User-Agent
`SeoToolBot/1.0 (+https://github.com/seo-tool)` (überschreibbar via
`CRAWLER_USER_AGENT`) und respektiert `robots.txt`.

### Ausführen

Ein einziges Kommando führt den kompletten realen End-to-End-`crawl_seed`-Zyklus
gegen `SMOKE_BASE_URL` aus (echtes `fetch`, robots.txt + User-Agent), persistiert
die Artefakte, prüft die Erfolgskriterien und gibt einen PASS/FAIL-Report aus.
Exit-Code 0 nur, wenn **alle** Kriterien bestehen.

```bash
# Minimal — gegen eine 1-seitige Site (kein Sitemap/keine Links nötig):
SMOKE_BASE_URL="https://example.com/" npm run smoke:crawl

# Eigene Test-Site mit Sitemap:
SMOKE_BASE_URL="https://deine-test-site.example/" \
SMOKE_SITEMAP_URL="https://deine-test-site.example/sitemap.xml" \
npm run smoke:crawl
```

Ohne `SMOKE_BASE_URL` druckt der Runner eine Usage-Hilfe und beendet sich mit
Exit-Code 0 (sicherer No-Op bei versehentlicher CI-/Invocation).

### Environment-Vertrag

| Variable | Pflicht | Default | Bedeutung |
| --- | --- | --- | --- |
| `SMOKE_BASE_URL` | ja | — | Basis-URL der zu crawlenden Site (ohne → No-Op, Exit 0) |
| `SMOKE_SITEMAP_URL` | nein | `<baseUrl>/sitemap.xml` | Sitemap-URL |
| `SMOKE_MAX_URLS` | nein | `25` | Obergrenze gefetchter URLs |
| `SMOKE_PROJECT_ID` | nein | `proj-smoke` | Projekt-ID |
| `SMOKE_SITE_ID` | nein | `site-smoke` | Site-ID |
| `DATABASE_URL` | nein | Wegwerf-PGlite (in `os.tmpdir()`, danach gelöscht) | Store-URL (z. B. Neon-Postgres) |
| `CRAWLER_USER_AGENT` | nein | `SeoToolBot/1.0 (+https://github.com/seo-tool)` | gesendeter User-Agent |

Ist `DATABASE_URL` gesetzt, schreibt der Runner dorthin; sonst legt er eine
Wegwerf-PGlite-Datei in `os.tmpdir()` an und löscht sie am Ende wieder.

## Erfolgskriterien (CRITERIA)

Der Runner prüft die folgenden Kriterien und druckt jedes als `PASS`/`FAIL`.
Die Schwellen sind bewusst lenient, damit eine minimale 1-seitige Site (z. B.
`example.com`, ohne Sitemap, ohne Links) besteht (`discovered>=1`,
`fetched>=1`). Exit 0 nur, wenn alle bestehen:

1. `job_claimed_and_succeeded` — der `crawl_seed`-Job wurde geclaimt und endet `succeeded`.
2. `discovered_urls` — `>= 1` discovered URL persistiert.
3. `fetch_results` — `>= 1` Fetch-Result persistiert.
4. `indexability_assessed` — für jede gefetchte URL existiert eine Indexability-Bewertung.
5. `crawl_run_completed_with_summary` — Crawl Run abgeschlossen mit Summary.
6. `health_score_computed` — Health Score wurde berechnet (`!== null`).

> Die reine Kriterien-Logik (`evaluateSmokeCriteria`) ist netzwerkfrei extrahiert
> und durch `services/crawler/test/smoke-criteria.test.ts` unit-getestet — so
> bleibt die Coverage erhalten, während der Runner selbst network-only/manuell ist.

## Einschränkungen

- Kein netzwerkabhängiger Test in CI — der echte Site-Smoke ist manuell.
- Vercel-Serverless ist statenlos; persistenter State liegt ausschließlich in Neon-Postgres.
- JS-Rendering, große Vollcrawls und externe Scheduler sind weiterhin außerhalb des Scopes.
```
