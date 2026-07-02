# Plan 008 — ESLint + Prettier (separat, später)

- **Kategorie:** DX / Tooling · **Aufwand:** M · **Risiko:** LOW · **Hängt ab von:** 002 (CI)
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

Das Repo hat **keinen** Linter und **keinen** Formatter (kein `.eslintrc*`, kein `eslint.config.*`,
kein `.prettierrc*` außerhalb `node_modules`). Es kompensiert mit Custom-Guards (`check:css-classes`,
`check:boundaries`, `validate:openapi`), aber ohne allgemeinen Style-/Qualitäts-Gate. Bewusst als
**eigener, späterer Plan** nach Plan 002: ESLint auf einer großen bestehenden Codebase erzeugt viele
Alt-Warnungen, die die frische CI **nicht** sofort rot färben sollen.

TS-Config-Layout zum Ausrichten: `tsconfig.base.json` (`strict`, `composite`, ES2022) + per-Workspace
`tsconfig.json` (`apps/web` mit Next-Plugin, `jsx: preserve`, excludet Tests).

## Gewählter Ansatz

1. **Flat-Config `eslint.config.mjs`** (ESLint 9) im Repo-Root:
   - `@eslint/js` (recommended) + `typescript-eslint`. Zunächst **ohne** typisierte Regeln
     (`recommended`, nicht `recommended-type-checked`) — die `composite`/`project`-References machen
     typed linting im Monorepo fehleranfällig; erst später nachziehen.
   - Für `apps/web` das Next-ESLint-Plugin (`eslint-config-next`/`@next/eslint-plugin-next`) ergänzen.
   - Ignorieren: `**/dist`, `**/.next`, `**/*.d.ts`, `.devdb/`, `node_modules`, generierte Dateien.
   - **Alle „Alt-Last"-Regeln als `warn`**, nicht `error` — damit `npm run lint` **nicht** mit Exit≠0
     bricht, solange die Warnungen noch nicht abgebaut sind.
2. **Prettier** minimal (`.prettierrc`) am vorhandenen Stil ausgerichtet (doppelte Quotes, 2-Space-
   Indent, keine Semikolon-Umstellung — vorher an ein paar Dateien den Ist-Stil ablesen). Ein
   `format:check`-Skript, das **nur prüft**, nichts umschreibt.
3. **Skripte** in root `package.json`: `"lint": "eslint ."`, `"format:check": "prettier --check ."`.
4. **CI (`.github/workflows/ci.yml` aus Plan 002):** einen **eigenen, nicht-blockierenden** Schritt/Job
   für `lint` + `format:check` ergänzen (`continue-on-error: true`), bis die Warnungen abgebaut sind.
   Den Kern-Job (`npm run check`) **nicht** um Lint erweitern — der bleibt streng grün.

## Scope

- **In scope:** `eslint.config.mjs`, `.prettierrc`, `.prettierignore` (optional), root `package.json`
  (Skripte + devDeps), `.github/workflows/ci.yml` (nicht-blockierender Lint-Schritt).
- **Explizit out of scope:** massenhafte Auto-Fixes / Reformatierung bestehender Dateien (das würde
  jeden Diff unlesbar machen — separater, bewusst getakteter Task); `--fix` im CI; Verschärfung von
  `warn` auf `error` (späterer Schritt, wenn eine Regel-Klasse auf 0 Warnungen ist).

## Verifikation (Done-Kriterien)

1. `npm run lint` läuft **ohne Crash** durch (Warnungen erlaubt, Exit 0 dank `warn`-Level).
2. `npm run format:check` läuft durch (darf Abweichungen listen, solange als nicht-blockierend
   konfiguriert).
3. `npm run typecheck` und `npm run check` unverändert grün (kein Eingriff in bestehende Checks).
4. Der neue CI-Lint-Schritt ist als nicht-blockierend markiert (ein roter Lint-Schritt blockt den Merge
   nicht).

## Test-Plan

Kein Unit-Test. Verifikation = die Befehle oben laufen sauber und die CI bleibt für den Kern-Job grün.
Optional an 2–3 Dateien prüfen, dass ESLint plausible echte Warnungen findet (nicht komplett stumm ist).

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Bricht typescript-eslint an den Projekt-References/`composite`-Builds, ohne typed
  Rules starten und melden — lieber ein funktionierender Basis-Linter als ein perfekter, der nicht läuft.
- Roadmap danach: Regel-Klasse für Regel-Klasse Warnungen abbauen und dann selektiv auf `error` heben;
  erst wenn eine Klasse stabil bei 0 ist, in den blockierenden Kern-Job aufnehmen.
- Prettier bewusst prüfend (nicht schreibend) halten, bis das Team eine einmalige Format-Migration
  bewusst durchführt (sonst kollidiert es mit offenen Branches).
