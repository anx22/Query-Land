# Plan 002 — CI-Workflow + `CLAUDE.md`

- **Kategorie:** DX / Tooling · **Aufwand:** S–M · **Risiko:** LOW · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

Die „Required checks" sind in `DOCS/MONOREPO_CONVENTIONS.md` definiert (typecheck, boundaries, openapi,
test), aber **nichts erzwingt sie**: es gibt kein `.github/workflows/`-Verzeichnis. Das Repo wird stark
von KI-Agenten weitergebaut (Commit-Historie referenziert Codex/Claude/PR-Review-Runden), es fehlt aber
eine `CLAUDE.md`-Einstiegsdatei, die Mandat, Checks und Guardrails an einer Stelle bündelt.

## Änderung A — CI-Workflow

Neu: **`.github/workflows/ci.yml`**

Anforderungen:
- Trigger: `push` auf `main` **und** `pull_request`.
- Ein Job, `runs-on: ubuntu-latest`.
- Node **22** hart setzen (keine `.nvmrc` vorhanden; lokal läuft v22.14).
- Schritte: `actions/checkout@v4` → `actions/setup-node@v4` (`node-version: 22`, `cache: 'npm'`)
  → `npm ci` → `npm run check`.
- **Keine Secrets** nötig — die Tests nutzen PGlite in-memory (`sqlite::memory:`), kein echtes Neon.

Warum `npm run check` genügt: es kettet `typecheck && check:boundaries && check:css-classes &&
validate:openapi && test`. Der `test`-Schritt nutzt ein POSIX-`NODE_ENV=test`-Präfix — das ist unter
Linux-CI unkritisch (nur lokal unter Windows-cmd/PowerShell ein Problem).

Referenz — root `package.json` (um Zeile 11–19):
```
"check": "npm run typecheck && npm run check:boundaries && npm run check:css-classes && npm run validate:openapi && npm test"
"test":  "npm run build && NODE_ENV=test node --test --test-concurrency=1 packages/domain-model/dist/test/*.test.js apps/api/dist/test/*.test.js services/crawler/dist/test/*.test.js services/mcp/dist/test/*.test.js"
```

## Änderung B — `CLAUDE.md` (Repo-Root)

Neu: **`CLAUDE.md`**. Inhalte aus vorhandenen Docs **destillieren, nicht neu erfinden**
(`DOCS/DECISIONS.md`, `DOCS/MONOREPO_CONVENTIONS.md`, `DOCS/ARCHITECTURE.md`, `README.md`). Gliederung:

1. **Projekt in einem Satz** + Verweis auf `DOCS/PRODUCT_MASTER_SPEC.md` (Produkt-Kontext).
2. **Workspace-Karte** — die Tabelle aus `DOCS/MONOREPO_CONVENTIONS.md` in Kurzform (wer darf was
   importieren: `packages/*` nicht aus `apps/*`/`services/*`).
3. **Agent-Mandat (DEC-004):** read-only + Ticket-Vorschläge in der aktuellen Welle; schreibende
   Aktionen bleiben review-pflichtig.
4. **Pflicht-Checks vor jedem PR:** `npm run typecheck`, `npm run check:boundaries`,
   `npm run validate:openapi`, `npm test` — mit dem **Windows-Hinweis**: `npm test`/`npm run check`
   scheitert lokal unter PowerShell/cmd am `NODE_ENV=test`-Präfix; Tests dort direkt über Git Bash
   ausführen (`NODE_ENV=test node --test … dist/test/*.test.js`) oder der CI überlassen.
5. **DB-Konvention:** Postgres (Neon prod) / embedded PGlite (lokal+Tests); Treiber-Auswahl aus dem
   `DATABASE_URL`-Schema in `apps/api/src/db/index.ts`; neue Migrationen als versionierte SQL-Datei
   unter `infra/db/postgres`.
6. **Off-limits:** keine destruktiven git-Operationen, keine Secrets committen, Decision-Docs
   (`DOCS/DECISIONS.md`) nicht ohne Review ändern.

Ton: knapp, scanbar, verlinkt auf die Detail-Docs statt sie zu duplizieren.

## Scope

- **In scope:** `.github/workflows/ci.yml` (neu), `CLAUDE.md` (neu).
- **Explizit out of scope:** jeder Produktivcode; ESLint/Prettier (das ist Plan 008); Änderungen an den
  bestehenden `check:*`-Skripten oder deren Verhalten; `.gitignore`.

## Verifikation (Done-Kriterien)

1. YAML valide (lokal `npx --yes @action-validator/cli .github/workflows/ci.yml`, sonst ein YAML-Lint).
2. Nach dem ersten Push/PR: **grüner CI-Lauf** — `npm run check` läuft auf CI durch (das entspricht dem,
   was lokal in einer früheren Session mit 239/239 Tests grün war).
3. `CLAUDE.md` rendert sauber, alle relativen Doc-Links auflösbar.

## Test-Plan

Kein neuer Unit-Test. Der CI-Workflow selbst ist die Verifikation: er muss auf einem realen PR grün
durchlaufen. Als Vorabprobe kann `npm ci && npm run check` in einer sauberen Kopie / auf Linux (WSL)
laufen.

## Wartungshinweis / Escape-Hatch

- Wenn `npm ci` auf CI wegen der **getrackten** `.devdb/`-Postgres-Binärdateien oder anderer großer
  Artefakte bricht → **STOP und melden**. Ein `.gitignore`-Umbau für `.devdb/` ist ein eigener Task
  (könnte Historien-/Bundling-Annahmen berühren), nicht Teil dieses Plans.
- Sobald Plan 008 (ESLint) kommt, wird der Workflow um einen **nicht-blockierenden** Lint-Job ergänzt —
  dieser Plan hält den Kern-Job bewusst schlank und grün.
- Node-Version zentral hier pflegen; falls später eine `.nvmrc` eingeführt wird, `setup-node` darauf
  umstellen.
