# CLAUDE.md — Arbeitsleitfaden für Agenten

Internes SEO-Werkzeug **Query-Land** für eigene Webplattformen: technische Qualität, organische
Sichtbarkeit, Content-Potenziale, Link-Autorität und AI-Visibility in einem entscheidungsfähigen
Workflow — jede Erkenntnis mit belegter Quelle. Produkt-Kontext:
[`DOCS/PRODUCT_MASTER_SPEC.md`](DOCS/PRODUCT_MASTER_SPEC.md).

## Workspace-Karte

npm-Workspaces-Monorepo (`apps/*`, `services/*`, `packages/*`):

| Pfad | Verantwortung | Darf importieren aus |
|------|---------------|----------------------|
| `apps/web` | Next.js 15 App Router UI (React 19), Routen, Screens | `packages/*` |
| `apps/api` | Hand-gerollte Node-HTTP-API, DTO-Validierung, Stores, DB-Adapter | `packages/*` |
| `services/*` | Hintergrund-Worker (Crawler, MCP-Server) | `packages/*` |
| `packages/domain-model` | Geteilte Domain-Typen, pure Validatoren, Scoring-Helfer | — (keine apps/services) |
| `packages/shared-config` | Runtime-Config, Stack-Entscheidungen | — (keine apps/services) |
| `infra/*` | SQL, Migrationen, Fixtures | — |
| `DOCS/*` | Source-of-Truth-Doku | — |

**Import-Richtung:** Apps/Services dürfen `packages/*` importieren; `packages/*` **nicht** aus
`apps/*`/`services/*`. Services importieren keine App-Internals — geteilte Worker-Verträge gehören in
`packages/domain-model`. Erzwungen von `scripts/check-boundaries.mjs` (`npm run check:boundaries`).

Web-Module: Feature-Routen zentral in `apps/web/src/app/module-routes.ts`; modul-spezifische Logik unter
`apps/web/src/features/<modul>`; `components/module-page.tsx` bleibt generischer Shell.

## Agent-Mandat (DEC-004)

Read-only + Ticket-/Proposal-Vorschläge in der aktuellen Welle; **PR-Vorschläge erst nach
Source-Map-Validierung** (spätere Welle). Alles Schreibende bleibt **review-pflichtig**. Details:
[`DOCS/DECISIONS.md`](DOCS/DECISIONS.md).

## Pflicht-Checks vor jedem PR

```bash
npm run typecheck          # tsc -b --pretty false
npm run check:boundaries   # Workspace-Import-Grenzen
npm run validate:openapi   # OpenAPI-Struktur
npm test                   # Build + node:test (domain-model/api/crawler/mcp)
```
Sammelbefehl: `npm run check` (kettet alle vier + `check:css-classes`).

**Windows-Hinweis:** `npm test`/`npm run check` scheitert lokal unter PowerShell/cmd am
`NODE_ENV=test`-Präfix (POSIX-Syntax). Tests dort **direkt über Git Bash** ausführen:
```bash
NODE_ENV=test node --test --test-concurrency=1 \
  packages/domain-model/dist/test/*.test.js apps/api/dist/test/*.test.js \
  services/crawler/dist/test/*.test.js services/mcp/dist/test/*.test.js
```
(vorher `npm run build`). Auf Linux-CI läuft `npm run check` unverändert (siehe
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Web-Tests separat: `npm --workspace @seo-tool/web run test` (Vitest).

## Datenbank & Migrationen

Postgres ist Default/Produktion (Neon); lokal + Tests nutzen embedded **PGlite** (Postgres-Dialekt, kein
separater DB-Server). Der Treiber wird aus dem `DATABASE_URL`-Schema in
[`apps/api/src/db/index.ts`](apps/api/src/db/index.ts) gewählt (`postgres://` → Neon;
`pglite:<path>`/`sqlite:<path>` → PGlite-Datei; `sqlite::memory:` → PGlite in-memory). Schema-Änderungen
als neue **versionierte** Migration unter `infra/db/postgres`.

## Off-limits

- Keine destruktiven git-Operationen (`reset --hard`, force-push) ohne ausdrückliche Aufforderung.
- **Keine Secrets committen** (Tokens/Keys); bei Fund: nur `file:line` + Typ nennen, Rotation empfehlen.
- Decision-Docs (`DOCS/DECISIONS.md`) nicht ohne Review ändern.
