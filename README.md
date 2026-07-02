# Query-Land — Internal SEO Operating System

Ein internes SEO-Werkzeug für **eigene** Webplattformen: technische Qualität, organische Sichtbarkeit,
Content-Potenziale, Link-Autorität und AI-Visibility in **einem** entscheidungsfähigen Workflow — jede
Erkenntnis mit belegter Quelle, jede Empfehlung bis in den eigenen Quellcode verankert und validierbar.

Was das Tool ist und warum: [`DOCS/PRODUCT_MASTER_SPEC.md`](DOCS/PRODUCT_MASTER_SPEC.md).
Aktueller Stand & Nächstes: [`DOCS/ROADMAP.md`](DOCS/ROADMAP.md).

## Struktur (Monorepo)

- `apps/web` — Next.js App Router (Oberfläche + eingebettete API-Proxy-Routen).
- `apps/api` — TypeScript-API (Stores, Routen, Connectors) — der gemeinsame Kern für UI und Agent/MCP.
- `packages/domain-model` — bindende Domain-Typen (die zentrale Vertragsquelle).
- `packages/shared-config` — Routing-Registry und Runtime-Konfiguration.
- `services/crawler` — Crawl-Worker.
- `infra/db/postgres` — versionierte Postgres-Migrationen.

## Datenbank

Postgres ist Default und Produktionsdatastore. Die Treiberwahl erfolgt zentral in
`apps/api/src/db/index.ts` anhand des `DATABASE_URL`-Schemas: `postgres://` → **Neon** (Produktion);
ohne separaten Server nutzen lokale Entwicklung und Tests embedded **PGlite** (Postgres-Dialekt).
(Einige Store-Dateien tragen aus Legacy-Gründen `sqlite-*`-Namen — rein kosmetisch.)

## Lokaler Start

```bash
npm install
npm run build
npm test
npm run check
npm --workspace @seo-tool/api start
npm --workspace @seo-tool/web dev
```

## Deployment

Ein einzelnes Vercel-Projekt (Root `apps/web`) bündelt Frontend und API. Das Crawling läuft in-process
über die Vercel-Cron-Route `/api/cron/crawl` (täglich, per `CRON_SECRET`) — kein externer Daemon.
Vercel-/Cron-Konfiguration lebt im Code (`next.config.mjs`, `/api/cron/crawl`, `.env.example`); für die
Google-Search-Console-Verbindung siehe [`DOCS/gsc-oauth-setup.md`](DOCS/gsc-oauth-setup.md).

## Doku

Der Einstieg in die (bewusst schlanke) Dokumentation: [`DOCS/README.md`](DOCS/README.md).
