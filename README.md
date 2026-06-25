# SEO-tool

Ein internes SEO Operating System für eigene Webplattformen, das technische Qualität, organische Sichtbarkeit, Content-Potenziale, Link-Autorität und AI-Visibility in einem entscheidungsfähigen Workflow vereint — und Erkenntnisse nicht nur misst, sondern bis in den eigenen Quellcode hinein in umsetzbare, validierbare Arbeit übersetzt.

## App Foundation

Der erste vertikale Schnitt folgt Welle 1 aus `DOCS/docs/PRODUCT_MASTER_SPEC.md`: Monorepo, Projekt-Kontext, Connector-Gerüst, Job-Monitoring, Source-Map-Grundgerüst und UI-Routing aus `DOCS/docs/UX_FLOWS.md`.

### Struktur

- `apps/web` — Next.js App Router Oberfläche mit der Hauptnavigation Overview, Projects, Technical Audit, Keywords & Rank, Content & Opportunities, Backlinks, Reports, AI Visibility und Settings.
- `apps/api` — schlankes TypeScript-API-Gerüst für gemeinsam nutzbaren Foundation-State.
- `packages/domain-model` — bindende Domain-Typen für Project, Integration, Jobs, Source Map, Evidence und Opportunity.
- `packages/shared-config` — Routing-Registry, SEO-Memory-Snapshot und Demo-Fixtures für den Welle-1-Schnitt.
- `infra/docker-compose.yml` — lokales Postgres-System-of-Record gemäß Master-Spec.

### Befehle

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
```
## Sprint 0 / Welle 1 Foundation

Die Foundation ist als Monorepo angelegt und folgt der Master-Spec. Der Stack ist:

- Frontend: Next.js/React in `apps/web`
- API: TypeScript Node HTTP API in `apps/api`
- Datenbank: **Postgres ist Default und Produktionsdatastore.** Der Treiber wird in `apps/api/src/db/index.ts` anhand des `DATABASE_URL`-Schemas gewählt: `postgres://`/`postgresql://` → Neon (Produktion), für lokale Entwicklung und Tests embedded PGlite (Postgres-Dialekt, kein separater DB-Server nötig).
- Job-System: Postgres-Queue (`job_queue`) mit transaktionalem Claiming
- Backend-Login: E-Mail/Passwort mit serverseitigem Scrypt-Hashing und Sessions in Postgres
- Domain-Verträge: `packages/domain-model`
- Shared Stack-/Runtime-Konfiguration: `packages/shared-config`
- Worker-Gerüst: `services/crawler`

### Datenbank

Postgres ist der Default- und Produktionsdatastore. In Produktion läuft Neon über `DATABASE_URL` (`postgres://`/`postgresql://`); für lokale Entwicklung und Tests wird embedded PGlite im Postgres-Dialekt genutzt — es ist kein separater DB-Server nötig. Die Treiberwahl erfolgt zentral in `apps/api/src/db/index.ts` anhand des `DATABASE_URL`-Schemas. (Hinweis: einige Store-Dateien tragen aus Legacy-Gründen weiterhin `sqlite-*`-Namen — das ist rein kosmetisch, der Datastore ist Postgres/PGlite.) Postgres-Migrationen liegen unter `infra/db/postgres/001..012`.

### Deployment

- Ein einzelnes Vercel-Projekt (Root-Verzeichnis `apps/web`) bündelt Frontend und API.
- Das Crawling läuft in-process über die Vercel-Cron-Route `/api/cron/crawl` (täglich), abgesichert per `CRON_SECRET` — kein externer Worker-Daemon.
- Details: `DOCS/deployment/serverless-crawl-worker.md`.

### Lokaler Start

```bash
npm install
npm run build
npm test
npm run check
npm --workspace @seo-tool/api start
npm --workspace @seo-tool/web dev
```

Optionaler Postgres-Kompatibilitätspfad:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Die ersten Foundation-Endpunkte sind in `DOCS/openapi/internal-api.yaml` definiert: `/health`, `/auth/register`, `/auth/login`, `/auth/session`, `/projects`, `/projects/{projectId}/sites`, `/integrations`, `/jobs` und `/source-map`.

### Welle-1-Gate-Smoke

Der reproduzierbare Welle-1-Smoke ist Teil von `npm test` und läuft gegen den embedded API-Handler mit `sqlite::memory:`. Er belegt den Foundation-Flow ohne Fixtures: Projekt anlegen → Site anlegen → Connector-Stub anlegen → `connector_sync`-Job sichtbar machen → erneuter API-Read hält Projekt, Site, Integration und Job.

Gezielt lokal ausführbar:

```bash
npm test -- --test-name-pattern "Welle 1 UI smoke"
```

### Worker-Smoke für WP-0.3

Der reproduzierbare Worker-Smoke ist unter `DOCS/tasks/worker-smoke.md` dokumentiert. Die wichtigsten lokalen Checks sind:

```bash
npm test -- --test-name-pattern "crawl worker claims crawl_seed job and persists crawl artifacts end-to-end"
npm test -- --test-name-pattern "sitemap index|redirect loops"
```


## Planung & Konventionen

- `DOCS/tasks/roadmap.md` — ★ aktive, konsolidierte Planungsquelle (Status, GAP-Register).
- `DOCS/tasks/parallel-execution-plan.md` — ★ paralleler Umsetzungsplan der offenen Punkte.
- `DOCS/tasks/decisions-backlog.md` — Produktentscheidungen (DEC-001–007).
- `DOCS/tasks/sprint-conventions.md` — Story-Template (DoR/DoD) + Testing-Matrix.
- `DOCS/docs/MONOREPO_CONVENTIONS.md` — Workspace-Regeln und Import-Boundaries.
- `DOCS/tasks/_archive/` — Historie (Phase-1-Abschluss, Handoff, Welle-Stories, Prep-Backlog).
