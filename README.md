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

Die Foundation ist als Monorepo angelegt und folgt der Master-Spec. Für die Codex-/Cloud-Umgebung ist das Backend jetzt bewusst **embedded und lokal ausführbar**:

- Frontend: Next.js/React in `apps/web`
- API: TypeScript Node HTTP API in `apps/api`
- Lokale Datenbank: SQLite via Node `node:sqlite` in `data/seo-os.sqlite`
- Skalierungsziel: Postgres bleibt als späterer Produktions-/Scale-out-Pfad erhalten
- Job-System: SQLite-basierte Queue (`job_queue`) mit demselben Contract wie die spätere Postgres-Queue
- Backend-Login: E-Mail/Passwort mit serverseitigem Scrypt-Hashing und Sessions in SQLite
- Domain-Verträge: `packages/domain-model`
- Shared Stack-/Runtime-Konfiguration: `packages/shared-config`
- Worker-Gerüst: `services/crawler`

### Warum SQLite als lokales Backend?

SQLite ist serverless/embedded: die API liest und schreibt direkt in eine lokale Datenbankdatei. Dadurch kann Codex die Datenbank hier vollständig anlegen, laden, ändern und testen, ohne Docker oder externen DB-Server. Für produktive Mehrnutzer-/Scale-Szenarien bleibt Postgres der Zielpfad aus der Master-Spec.

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


## Vorbereitungsdokumente für Sprintstart

- `DOCS/tasks/preparation-hardening-backlog.md` — abgeschlossene Vorbereitungshärtung und empfohlene nächste Reihenfolge.
- `DOCS/docs/MONOREPO_CONVENTIONS.md` — Workspace-Regeln und Import-Boundaries.
- `DOCS/docs/MIGRATION_STRATEGY.md` — SQLite-lokal zu Postgres-Zielpfad.
- `DOCS/tasks/story-template.md` — Definition of Ready/Done und Story-Format.
- `DOCS/tasks/testing-matrix.md` — Pflichtchecks pro Story/Welle.
- `DOCS/tasks/welle-1-rest-stories.md` und `DOCS/tasks/welle-2-audit-core-stories.md` — sprintfertige Story Seeds.
