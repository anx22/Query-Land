# Worker Smoke — WP-0.3

Stand: 2026-06-06

## Ziel

Dieses Dokument macht den `crawl_seed`-Worker-Smoke reproduzierbar. Der Smoke belegt für WP-0.3, dass der Worker Jobs claimt, Crawl-Artefakte persistiert, Crawl Runs abschließt und bei Sitemap-Index-/Redirect-Edge-Cases erklärbar bleibt.

## Automatisierter Fixture-Smoke

Der Fixture-Smoke ist Teil von `npm test` und läuft komplett lokal mit `sqlite::memory:` und einem deterministischen `fetchImpl`.

```bash
npm test -- --test-name-pattern "crawl worker claims crawl_seed job and persists crawl artifacts end-to-end"
```

Er prüft:

1. `crawl_seed`-Job wird geclaimt.
2. Sitemap-URLs werden als `discovered_urls` persistiert.
3. Fetch Results, Indexability Assessments, Audit Issues und Health Score werden geschrieben.
4. Crawl Run wird mit Summary abgeschlossen.
5. Job endet `succeeded`.

Zusätzliche WP-0.3-Härtungs-Smokes:

```bash
npm test -- --test-name-pattern "sitemap index|redirect loops"
```

Diese prüfen:

- Sitemap-Index-Auflösung nur für in-scope Sitemap-Dateien.
- Persistenz der aus einem Sitemap-Index entdeckten Seiten.
- Redirect-Loop-Erkennung, bevor der Crawler unbegrenzt weiterläuft.

## Lokaler Smoke gegen eine echte eigene Content/SaaS-Site

Voraussetzungen:

1. API mit persistenter lokaler SQLite-Datei starten.
2. Projekt und Site über API/UI anlegen.
3. `crawl_seed`-Job mit `siteId`, `baseUrl` und optional `sitemapUrl` erzeugen.
4. Worker einmalig ausführen.

Beispielablauf:

```bash
npm --workspace @seo-tool/api start
npm --workspace @seo-tool/crawler run start:once
```

Für den Job-Payload gilt:

```json
{
  "siteId": "site-...",
  "baseUrl": "https://deine-domain.example/",
  "sitemapUrl": "https://deine-domain.example/sitemap.xml"
}
```

## Erfolgskriterien

Ein echter Site-Smoke gilt als bestanden, wenn:

- der `crawl_seed`-Job `succeeded` oder bei bewusstem Fixture-Fehler nachvollziehbar `failed` ist,
- ein Crawl Run mit Summary vorhanden ist,
- `discovered_urls`, Fetch Results, Indexability Assessments und Health Score persistiert wurden,
- Sitemap-Index-Dateien nur in-scope verfolgt wurden,
- Redirect-Loops als erklärbarer `network_error` statt als Endloslauf sichtbar werden.

## Einschränkungen

- Vercel-Serverless-SQLite ist ephemer; echte Site-Smokes lokal oder gegen ein persistentes Ziel ausführen.
- JS-Rendering, große Vollcrawls und externe Scheduler sind weiterhin außerhalb von WP-0.3.
