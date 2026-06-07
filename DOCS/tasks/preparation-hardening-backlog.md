# Preparation Hardening Backlog — offene Vorbereitungen nach Sprint 0 / Welle 1

> Ziel: Nur die noch offenen Schärfungs- und Präzisierungsarbeiten erfassen. Bereits vorhandene Foundation-Bestandteile werden nicht erneut eingeplant, sondern unten unter „Nicht erneut planen / bereits erledigt“ ausdrücklich übersprungen.
>
> Referenz: Master §10 Welle 1 Gate („Domain anlegen, Crawl starten, GSC/GA4 verbinden“) und §12.2 vertikaler Schnitt.

## Nicht erneut planen / bereits erledigt

Diese Punkte sind in der aktuellen Foundation vorhanden und werden **nicht** als neue Tasks angelegt:

- Monorepo-Basis mit `apps/web`, `apps/api`, `services/crawler`, `packages/domain-model`, `packages/shared-config`, `infra`.
- Next.js/React Landing UI für die Foundation.
- TypeScript Node API mit SQLite Store.
- Embedded SQLite Schema inklusive `users`, `sessions`, `projects`, `sites`, `integration_accounts`, `raw_events`, `normalized_metrics`, `job_queue`, Source-Map-Tabellen, `audit_logs`, `feature_flags`.
- Backend Login mit Registrierung, Login und Session-Auflösung.
- Erste OpenAPI-Pfade für Auth, Health, Projects, Sites, Integrations, Jobs und Source Map.
- Basis-Tests für Domain-Model, API, Auth und idempotente Jobs.
- Postgres-Kompatibilitätspfad via `infra/docker-compose.yml` und Postgres SQL-Init.

---

## Status-Legende

- `todo` — noch nicht begonnen.
- `ready` — ausreichend präzisiert, kann umgesetzt werden.
- `blocked` — benötigt fachliche Entscheidung.
- `done` — erledigt; hier nur verwenden, wenn ein Task bewusst geschlossen wird.

---

## A. OpenAPI schärfen

### PREP-API-001 — API-Fehlerformat vereinheitlichen

- **Status:** done
- **Priorität:** P0
- **Warum:** Aktuell existieren einfache `{ error }` Antworten. Für UI, Agent/MCP und Tests braucht die API ein stabiles Fehlerformat.
- **Scope:**
  - Einheitliches Schema `ApiError` definieren: `code`, `message`, `details`, `requestId`.
  - Alle 4xx/5xx Responses in `DOCS/openapi/internal-api.yaml` darauf referenzieren.
  - API-Router in `apps/api/src/app.ts` auf das Format umstellen.
- **Akzeptanzkriterien:**
  - Jeder Endpunkt dokumentiert mindestens 400/401/404 bzw. relevante Fehler.
  - Tests prüfen mindestens einen Validation-Fehler, Auth-Fehler und Not-found-Fehler.

### PREP-API-002 — Request-/Response-Schemas vollständig typisieren

- **Status:** done
- **Priorität:** P0
- **Warum:** Mehrere Endpunkte akzeptieren im Code `Partial<T>` oder lose Bodies. Für stabilen Contract müssen Request-DTOs getrennt von Domain-Entities sein.
- **Scope:**
  - `CreateProjectRequest`, `CreateSiteRequest`, `CreateIntegrationRequest`, `CreateJobRequest`, Auth-Requests gegen Code-DTOs spiegeln.
  - Keine OpenAPI-Request-Schemas direkt aus Response-Entities ableiten.
  - Nullable/optional Felder in OpenAPI konsistent definieren.
- **Akzeptanzkriterien:**
  - Für jeden Welle-1-Endpunkt existiert ein Request- und Response-Schema.
  - API-Tests decken Pflichtfelder und ungültige Werte ab.

### PREP-API-003 — OpenAPI maschinell validieren

- **Status:** done
- **Priorität:** P1
- **Warum:** Der Contract soll später UI und Agent/MCP speisen; YAML muss CI-validierbar sein.
- **Scope:**
  - Script `npm run validate:openapi` ergänzen.
  - Leichtgewichtigen Validator auswählen und dokumentieren.
  - CI-/lokalen Check in README aufnehmen.
- **Akzeptanzkriterien:**
  - `npm run validate:openapi` läuft lokal grün.
  - Ungültige YAML/Schema-Refs führen zu Fehlercode ungleich 0.

### PREP-API-004 — Auth-Security-Semantik präzisieren

- **Status:** done
- **Priorität:** P1
- **Warum:** `/auth/session` ist dokumentiert, aber welche Foundation-Endpunkte später Auth benötigen, ist noch nicht festgelegt.
- **Scope:**
  - Sicherheitsmatrix definieren: public, authenticated, owner/editor/viewer.
  - OpenAPI `security` pro Pfad ergänzen.
  - Übergangsregel dokumentieren: lokale Entwicklung darf Auth optional machen, Produktbetrieb nicht.
- **Akzeptanzkriterien:**
  - Jeder Pfad hat eine klare Auth-Klasse.
  - Security-Spec referenziert dieselbe Matrix.

---

## B. Monorepo-Struktur schärfen

### PREP-REPO-001 — Workspace-Konventionen dokumentieren

- **Status:** done
- **Priorität:** P1
- **Warum:** Die Struktur existiert, aber Regeln für neue Apps/Services/Packages fehlen.
- **Scope:**
  - Datei `DOCS/tasks/monorepo-conventions.md` oder `DOCS/docs/MONOREPO_CONVENTIONS.md` erstellen.
  - Regeln für Import-Richtung: Apps/Services dürfen Packages importieren; Packages nicht Apps/Services.
  - Regeln für Tests, Fixtures, Build-Outputs, Env-Dateien und Migrationsorte.
- **Akzeptanzkriterien:**
  - Neue Welle kann anhand der Konventionen entscheiden, wo Code liegt.
  - README oder DOCS-README verlinkt die Konventionen.

### PREP-REPO-002 — Package Boundaries technisch absichern

- **Status:** done
- **Priorität:** P2
- **Warum:** TypeScript-References bauen, aber verbotene Querverweise werden noch nicht geprüft.
- **Scope:**
  - Boundary-Regeln mit ESLint oder eigenem Script prüfen.
  - Mindestens verbieten: `packages/*` importiert aus `apps/*` oder `services/*`.
  - Script `npm run check:boundaries` ergänzen.
- **Akzeptanzkriterien:**
  - Boundary-Verstoß erzeugt Fail.
  - Check läuft ohne False Positives auf aktuellem Repo.

### PREP-REPO-003 — Dev-Scripts für parallelen Start definieren

- **Status:** done
- **Priorität:** P2
- **Warum:** API und Web lassen sich einzeln starten, aber ein Ein-Kommando-Dev-Flow fehlt.
- **Scope:**
  - Script `npm run dev` ergänzen, das API und Web parallel startet.
  - Ohne schwere Abhängigkeit bevorzugen; falls Tool nötig, begründen.
  - Env-Voraussetzungen dokumentieren.
- **Akzeptanzkriterien:**
  - `npm run dev` startet API und Web.
  - README beschreibt Ports und SQLite-Dateipfad.

---

## C. App-Code präzisieren

### PREP-APP-001 — Store-Interface von HTTP-Router trennen

- **Status:** done
- **Priorität:** P0
- **Warum:** Der Store ist bereits abstrahiert, aber DTO-Validierung, Fehlerbehandlung und Persistenzlogik sind noch zu eng im API-Pfad gekoppelt.
- **Scope:**
  - `apps/api/src/routes/*` für Routing/DTO-Validierung.
  - `apps/api/src/store/*` für Persistenz.
  - `apps/api/src/services/*` für Auth-/Job-/Project-Use-Cases.
- **Akzeptanzkriterien:**
  - Auth-, Project- und Job-Tests laufen unverändert oder präziser.
  - Store kann in Tests weiter mit `sqlite::memory:` instanziiert werden.

### PREP-APP-002 — Eingabevalidierung ohne lose `Partial<T>` implementieren

- **Status:** done
- **Priorität:** P0
- **Warum:** `Partial<Project>`/`Partial<Site>` lässt ungültige Felder zu und vermischt Domain- mit Request-Typen.
- **Scope:**
  - DTO-Typen im Domain-Model oder API-Modul anlegen.
  - Runtime-Validatoren für Auth, Project, Site, Integration, Job.
  - Validierungsfehler über `ApiError` aus PREP-API-001 zurückgeben.
- **Akzeptanzkriterien:**
  - Tests für fehlende Pflichtfelder, ungültige URLs, ungültige Provider, ungültige Job-Typen.

### PREP-APP-003 — SQLite-Schreibfehler robust behandeln

- **Status:** done
- **Priorität:** P1
- **Warum:** Unique-Constraint-/FK-Fehler werden aktuell generisch behandelt.
- **Scope:**
  - Constraint-Fehler auf stabile API-Fehlercodes mappen, z. B. `duplicate_project_slug`, `unknown_project`, `duplicate_integration`.
  - Tests für doppelte E-Mail, doppelte Projekt-Slugs, Integration für unbekanntes Projekt.
- **Akzeptanzkriterien:**
  - Keine rohen SQLite-Fehlermeldungen in API-Antworten.
  - Fehlercodes sind in OpenAPI dokumentiert.

### PREP-APP-004 — Minimale Login-UI vorbereiten

- **Status:** done
- **Priorität:** P1
- **Warum:** Backend-Login existiert, aber UI zeigt ihn nur als Karte.
- **Scope:**
  - Route `/login` mit Formular für E-Mail/Passwort.
  - Session-Token lokal für Entwicklung speichern.
  - Route `/dashboard` liest `/auth/session` und zeigt Benutzer/Projekt-Summary.
- **Akzeptanzkriterien:**
  - Login-Flow funktioniert gegen lokale API.
  - UI-Fehler für ungültige Credentials sichtbar.

---

## D. Technische Foundation vervollständigen

### PREP-FOUND-001 — Migration-Strategie für SQLite ↔ Postgres definieren

- **Status:** done
- **Priorität:** P0
- **Warum:** SQLite ist lokal richtig, Postgres bleibt Produktionsziel. Der Übergang muss bewusst gestaltet werden.
- **Scope:**
  - Migrationskonvention festlegen: Dateinamen, Versionierung, idempotente Migrationen.
  - SQLite- und Postgres-Schema-Differenzen dokumentieren.
  - Entscheidung treffen: eigenes SQL-Migrationsscript oder Tool.
- **Akzeptanzkriterien:**
  - Neue Tabellen/Spalten haben klaren Migrationspfad für beide DBs.
  - README erklärt lokalen SQLite-Default und Postgres-Zielpfad.

### PREP-FOUND-002 — Job-Queue-Verarbeitung implementieren

- **Status:** done
- **Priorität:** P0
- **Warum:** `job_queue` existiert und Jobs werden angelegt; ein Worker, der queued Jobs claimt/ausführt, fehlt noch.
- **Scope:**
  - Claim-Mechanik: `queued → running → succeeded|failed`.
  - Idempotenz beibehalten.
  - Retry-/Attempts-Regeln definieren.
  - `services/crawler` an `crawl_seed` anschließen.
- **Akzeptanzkriterien:**
  - Test: queued Job wird genau einmal geclaimt.
  - Fehler setzt `failed` und `last_error`.
  - Wiederholung erhöht `attempts`.

### PREP-FOUND-003 — Request-ID und strukturierte Logs einführen

- **Status:** done
- **Priorität:** P1
- **Warum:** Observability-Spec fordert sichtbare Fehler; Request-/Job-Korrelation fehlt noch.
- **Scope:**
  - Request-ID pro API-Aufruf erzeugen oder übernehmen.
  - Logs als JSON Lines ausgeben.
  - Fehlerantworten enthalten `requestId`.
- **Akzeptanzkriterien:**
  - Tests prüfen Request-ID im Fehlerfall.
  - Logs enthalten `service`, `version`, `requestId`, `path`, `status`.

### PREP-FOUND-004 — Auth-Hardening für lokale Foundation definieren

- **Status:** done
- **Priorität:** P1
- **Warum:** Login ist funktional, aber noch ohne Rate Limit, Logout, Session-Rotation und Passwort-Reset.
- **Scope:**
  - `POST /auth/logout` hinzufügen.
  - Session-Expiry und Cleanup-Job definieren.
  - Einfaches Rate-Limit für Login-Versuche in SQLite prüfen.
  - Passwortwechsel-Flow für lokale Entwicklung vorbereiten.
- **Akzeptanzkriterien:**
  - Logout invalidiert Session.
  - Abgelaufene Sessions werden nicht akzeptiert.
  - Security-Spec aktualisiert.

### PREP-FOUND-005 — Test-Matrix festlegen

- **Status:** done
- **Priorität:** P1
- **Warum:** Build, API-Tests und Web-Build laufen, aber es gibt noch keine klare Matrix für jede Welle.
- **Scope:**
  - Testarten definieren: unit, API contract, DB migration, worker, UI smoke.
  - Commands je Kategorie dokumentieren.
  - Minimal-Gate für Welle 2 festlegen.
- **Akzeptanzkriterien:**
  - Testing-Matrix in `DOCS/tasks/sprint-conventions.md` oder Abschnitt in diesem Backlog existiert.
  - Jede neue Welle kennt Pflichtchecks.

---

## E. Sprint-Backlog / User Stories ausarbeiten

### PREP-STORY-001 — Sprint-Backlog-Format festlegen

- **Status:** done
- **Priorität:** P0
- **Warum:** Die Wellen existieren, aber für sprintweise Entwicklung fehlen standardisierte Stories.
- **Scope:**
  - Story-Template definieren: Rolle, Ziel, Nutzen, Scope, Non-Scope, Akzeptanzkriterien, Test-Gate, Spec-Refs, API-Refs.
  - Definition of Ready und Definition of Done für Stories festlegen.
- **Akzeptanzkriterien:**
  - Template ist in `DOCS/tasks/sprint-conventions.md` dokumentiert.
  - Jede zukünftige Story kann gegen Master §12 geprüft werden.

### PREP-STORY-002 — Welle-1 Reststories ableiten

- **Status:** done
- **Priorität:** P0
- **Warum:** Welle 1 Gate ist noch nicht vollständig: Domain anlegen ist möglich, aber Crawl starten und GSC/GA4 verbinden sind nur vorbereitet.
- **Scope:**
  - Story 1: Projekt + Domain anlegen und persistent anzeigen.
  - Story 2: GSC/GA4 Connector als Stub verbinden und Sync-Job planen.
  - Story 3: Crawl Seed Job starten und Status verfolgen.
  - Story 4: Source-Map-Refresh starten und Mapping anzeigen.
- **Akzeptanzkriterien:**
  - Jede Story hat Akzeptanztests und API/UI-Scope.
  - Storys bleiben klein genug für einzelne Codex-Umsetzung.

### PREP-STORY-003 — Welle-2 Audit-Core Stories vorbereiten

- **Status:** done
- **Priorität:** P1
- **Warum:** `crawl-engine.md` und `issue-rules.md` sind noch Gerüste; Welle 2 braucht vorbereitete Stories.
- **Scope:**
  - Crawl-Engine-Spec vor Welle 2 schärfen.
  - Issue-Rules-Minimum definieren: HTTP status, canonical, robots, title/meta, broken links.
  - Stories für Discovery, Fetch, Normalize, Issue Generation, Health Score v0.
- **Akzeptanzkriterien:**
  - Mindestens fünf Welle-2 Stories mit Test-Gates existieren.
  - Keine Story hängt von produktiven Drittanbieter-APIs ab.

### PREP-STORY-004 — Offene Produktentscheidungen in Decisions-Backlog überführen

- **Status:** done
- **Priorität:** P1
- **Warum:** Master §A.5 nennt offene Entscheidungen, die Scope und Priorisierung beeinflussen.
- **Scope:**
  - Plattform-Typen im Scope.
  - Competitor Intelligence Provider ja/nein ab V1.
  - Märkte zuerst.
  - Agent-Mandat.
- **Akzeptanzkriterien:**
  - Jede Entscheidung hat Optionen, Empfehlung, Impact und spätesten Entscheidungszeitpunkt.
  - Blockierte Stories referenzieren die jeweilige Entscheidung.

---

## Sprintstart-Status

Alle Vorbereitungstasks sind abgeschlossen oder in sprintfertige Umsetzungs-/Decision-Artefakte überführt. Die eigentliche Produktentwicklung kann mit den Welle-1-Reststories und anschließend Welle-2 Audit-Core starten.

## Empfohlene Reihenfolge für die ersten Sprints

1. W1-REST-001 — Projekt und Domain persistent anzeigen.
2. W1-REST-002 — GSC/GA4 Stub verbinden und Sync-Job planen.
3. W1-REST-003 — Crawl Seed Job starten und Status verfolgen.
4. W1-REST-004 — Source-Map-Refresh starten und Mapping anzeigen.
5. W2-AUDIT-001 bis W2-AUDIT-005 — Audit-Core vertikal umsetzen.
