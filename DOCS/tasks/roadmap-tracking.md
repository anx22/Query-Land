# Roadmap Tracking — Bestandsaufnahme, Gates und nächste Sprints

> Zweck: offizielles Tracking-Dokument für den aktuellen Implementierungsstand nach der Foundation- und Crawl-Pipeline-Arbeit. Dieses Dokument ergänzt `docs/PRODUCT_MASTER_SPEC.md` §10 und die Wave-Backlogs in `tasks/`.
>
> Stand: 2026-06-03 · Quelle: Code-/Test-Bestandsaufnahme nach `Add crawl pipeline: domain types, DB schema, API routes and crawler service; migrate packages to @seo-tool scope`.

## 1. Dokumentationsstruktur und Wahrheitsebenen

Die Dokumentation ist bewusst gestuft aufgebaut:

- `docs/PRODUCT_MASTER_SPEC.md` bleibt die oberste Wahrheitsebene. Besonders relevant sind §10 Delivery-Wellen und §12.2 vertikaler Schnitt.
- `specs/*.md` verfeinern Module und Querschichten. Für die aktuelle Arbeit sind vor allem `specs/crawl-engine.md`, `specs/issue-rules.md`, `specs/observability-sre.md`, `specs/security-privacy.md` und `specs/source-map.md` relevant.
- `openapi/internal-api.yaml` ist der maschinenlesbare interne API-Vertrag für UI und Agent/MCP.
- `tasks/*.md` enthält Sprint-/Wave-Tracking, Story Seeds, Test-Gates, offene Entscheidungen und diese Roadmap.
- `prompts/codex-*.md` bleiben Ausführungsprompts je Welle und sollten nur mit konkretem Scope angepasst werden.

**Regel:** Wenn diese Roadmap einem Master-Abschnitt widerspricht, gewinnt `docs/PRODUCT_MASTER_SPEC.md`. Wenn eine Child-Spec einem API-Vertrag widerspricht, muss der Widerspruch explizit in `tasks/decisions-backlog.md` erfasst werden.

## 2. Aktueller Stand in Kurzform

| Bereich | Stand | Einschätzung | Nächster Hebel |
|---|---:|---|---|
| Monorepo/Build/Test Foundation | 75–85 % | lokal stabil, Checks grün | CI-/Dependency-/Deployment-Härtung |
| Domain Model Foundation + Crawl Core | 65–75 % | gute Basis für Welle 1/2 | DTOs/Migrationskontrakte trennen, spätere Module ergänzen |
| API Foundation + Crawl API | 60–70 % | viele Endpunkte, getestet | AuthZ, Pagination, Filter, Route-Aufteilung |
| SQLite Local Backend | 60–70 % | gut für lokale Ausführung | echte Migrationen, Transaktionen, Retention |
| Crawler Core Library | 35–45 % | nützliche Heuristik-Library | Worker-Orchestrierung, Robots, Linkgraph |
| Frontend Produkt-UI | 15–25 % | Demo Shell | echte API-Anbindung, Technical-Audit UI |
| Observability/Ops/Security | 15–25 % | erste Health-/Log-Basis | Request-/Job-Tracing, Audit-Fix, Secrets/AuthZ |
| Gesamt-App | 30–40 % | MVP-Kern vorhanden, Produkt noch unfertig | vertikaler UI+Worker-Schnitt |

## 3. Befund der Fehlerprüfung

### 3.1 Grüne Checks

- `npm run check` läuft aktuell grün: TypeScript-Typecheck, Workspace-Boundary-Check, OpenAPI-Strukturvalidierung und Node-Test-Suites bestehen.
- Die API-/Store-Tests decken Foundation, Auth, Jobs und Crawl-Artefakte ab: Discovery, Fetch Results, Indexability, Audit Issues, Health Scores und Crawl Runs.
- OpenAPI wird strukturell validiert und enthält die neuen Crawl-Endpunkte.

### 3.2 Rote / gelbe Befunde

- `npm audit --audit-level=moderate` meldet 2 moderate Findings über Next/PostCSS. `npm audit fix --force` würde laut npm einen Breaking-Downgrade installieren und ist deshalb nicht automatisch anzuwenden.
- `apps/web` nutzt weiterhin Demo-Fixtures aus `@seo-tool/shared-config`; die echte SQLite/API-Pipeline wird im UI noch nicht produktiv konsumiert.
- `services/crawler` ist noch keine laufende Worker-Pipeline, sondern eine Library mit Discovery-/Fetch-/Audit-Helfern.
- SQLite-Schema ist ein großer idempotenter SQL-String; ein versioniertes Migrationssystem fehlt.
- API-Routing, Request-Validierung und Store-Persistenz wachsen in wenigen großen Dateien und müssen vor weiterem Ausbau modularisiert werden.
- Business-Endpunkte sind noch nicht projekt-/rollenbasiert geschützt; Auth existiert, AuthZ-Gates fehlen.
- Crawler-Heuristiken nutzen einfache Regex-Extraktion für HTML-Metadaten; robustes HTML-/Robots-/Sitemap-Parsing fehlt.

## 4. Wave-Status gemäß Master §10

### 4.1 Welle 1 — Foundation Gate schließen

**Master-Gate:** Domain anlegen, Crawl starten, GSC/GA4 verbinden.

| Slice | Backend | UI | Status | Offene Lücke |
|---|---|---|---|---|
| Project/Site persistieren | vorhanden | Demo/teilweise | backend_done_ui_gap | UI muss SQLite/API lesen/schreiben |
| GSC/GA4 Stub + Sync Job | vorhanden | Demo/teilweise | backend_done_ui_gap | Connector-UI und Job-Planung sichtbar machen |
| Crawl Seed Job starten/status verfolgen | Queue + Crawl Runs vorhanden; Worker kann `crawl_seed` claimen und abschließen | Teilweise | worker_slice_in_progress | Start-Crawl-Button erzeugt Worker-Payload; Robots-Details/echte-Site-Smoke fehlt |
| Source Map Refresh + Mapping anzeigen | Listing vorhanden | Demo/teilweise | backend_done_ui_gap | Refresh-Job und echte Mapping-Ansicht |

**Welle-1-Entscheidung:** Backend ist weitgehend vorhanden. Das Gate ist erst geschlossen, wenn UI-Smokes die echten API-Flows nachweisen.

### 4.2 Welle 2 — Audit Core nutzbar machen

**Master-Gate:** 95 % stabile Vollcrawls auf eigenen Sites.

| Slice | Aktueller Stand | Status | Offene Lücke |
|---|---|---|---|
| URL Discovery v0 | Domain/API/DB/Tests vorhanden | contract_done | Worker muss echte Sitemap/Seed-Pipeline schreiben |
| HTTP Fetch Worker v0 | Normalisierungslogik + Persistenz vorhanden | contract_done | Queue-Worker mit Retry/Timeout fehlt |
| Indexability Checks v0 | Klassifikation + Persistenz vorhanden | contract_done | Integration in Worker und UI-Explorer fehlt |
| Issue Rules Minimum Set | Rules + Persistenz, Resolve-Endpoint und UI-Filter vorhanden | in_progress | Pagination und Reopen/Dismiss fehlen |
| Health Score v0 | Score + Snapshots vorhanden | contract_done | Score-UI und automatische Recompute-Policy fehlen |
| Crawl Runs | Lifecycle + Summary vorhanden; Worker schließt Fixture-Runs mit Artefakten ab | in_progress | Daemon/echte Site-Robustheit fehlt |
| Interner Linkgraph | nicht implementiert | todo | Link-Extraktion, Edges, Depth, Orphans |
| Robots/Sitemap robust | erster robots.txt-Disallow-Filter + Scope-Policy vorhanden | in_progress | Crawl-delay/User-Agent-Gruppen, Sitemap-Index |
| Web Vitals | nicht implementiert | todo | PSI/Lighthouse Connector oder Stub |

**Welle-2-Entscheidung:** Der API-/Persistenzkern ist gut genug, um den nächsten Sprint auf Worker+UI statt weitere Tabellen zu fokussieren.

## 5. Offizielle nächste Sprint-Sequenz

### Sprint A — Foundation UI echt machen

**Ziel:** Welle-1-Gate schließen, indem das UI echte API-/SQLite-Daten nutzt.

**Scope:**

1. Dashboard lädt `/projects`, `/projects/{projectId}/sites`, `/integrations`, `/jobs`, `/source-map` aus der API statt Demo-Fixtures.
2. Project-/Site-CRUD als minimale Formulare und Tabellen.
3. Connector-Stubs für GSC/GA4 erstellen und Sync-Job planen.
4. Job Monitor gegen echte Queue-Daten anzeigen.
5. Login-Flow sichtbar nutzen oder bewusst als dev-only markieren.

**Nicht-Scope:** vollständiges Design-System, Multi-User-Admin, externe OAuth-Flows.

**Done-Gate:** UI-Smoke zeigt: Projekt anlegen → Site anlegen → Connector Stub anlegen → Job sichtbar → Reload hält Daten.

### Sprint B — Crawl Run Worker v0

**Ziel:** Welle-2 vom Contract-Kern zu einer echten laufenden Crawl-Pipeline bringen.

**Scope:**

1. Worker claimt `crawl_seed`/Crawl-Run-Jobs aus `job_queue`.
2. Worker erstellt Crawl Run und führt Seed-/Sitemap-Discovery aus.
3. Worker speichert Discovered URLs, Fetch Results, Indexability Assessments, Audit Issues.
4. Worker berechnet Health Score und schließt Crawl Run ab.
5. Retry-/Timeout-/Failure-Mode für mindestens Network Error und ungültige Sitemap.

**Nicht-Scope:** JS Rendering, Vollcrawl >5k, externes Scheduling, Web Vitals.

**Done-Gate:** Ein Fixture-Crawl läuft end-to-end durch Worker und erzeugt persistierte Artefakte plus Crawl-Run-Summary. Der erste programmatische Worker-Cycle plus HTTP-Worker-Startscript ist umgesetzt; offen bleibt ein robuster Betrieb gegen echte Sites inklusive Robots-Details und Sitemap-Index.

### Sprint C — Technical Audit UI v0

**Ziel:** Welle-2 fachlich sichtbar/nutzbar machen.

**Scope:**

1. Technical-Audit-Seite zeigt Crawl Runs, letzten Health Score und Issue Counts.
2. URL Explorer listet Discovered URLs mit latest Fetch/Indexability State. (Detaildaten sind angebunden; Pagination/Drawer fehlen.)
3. Issue-Tabelle mit Severity, Rule, URL, Status und Filter.
4. Buttons: Crawl starten, Health neu berechnen, Issue als resolved markieren.
5. Empty/Error/Loading States.

**Nicht-Scope:** Deep Segmentation, Export, Alerts, Web Vitals.

**Done-Gate:** User kann Crawl starten und danach Issues/Health/URL-Details ohne manuelle API-Aufrufe sehen.

### Sprint D — Härtung vor Welle 3

**Ziel:** technische Schulden reduzieren, bevor Keyword/Rank Core aufsetzt.

**Scope:**

1. API-Routen modularisieren (`routes/*`, `validators/*`, `store/*`).
2. Versionierte Migrationen für SQLite einführen; Postgres-Zielpfad nachziehen.
3. AuthZ pro Projekt/Site und Rollen-Gates für Mutations.
4. Pagination/Filter/Limit für Listen-Endpunkte.
5. Next/PostCSS-Audit-Befund gezielt beheben oder dokumentiert risk-accepten.
6. Structured logs für Jobs/Crawl Runs mit Request-/Run-Korrelation.

**Done-Gate:** `npm run check`, Web-Build, Audit-Entscheidung dokumentiert, Migration-Smoke grün.

## 6. Verbesserungs- und Lückenregister

| ID | Bereich | Befund | Empfehlung | Priorität | Ziel-Sprint |
|---|---|---|---|---|---|
| GAP-UI-001 | Frontend | UI nutzt echte Foundation-/Technical-Audit-Daten; URL Detail Drawer fehlt | API-Client und echte Dashboard-/Technical-Audit-Daten | P0 | A/C |
| GAP-WORKER-001 | Crawler | Crawler-Service nicht an Job Queue gekoppelt | Worker für Crawl Run Pipeline bauen | P0 | B |
| GAP-MIG-001 | DB | SQLite-Migration Runner vorhanden; Postgres-Migrationen fehlen | Postgres SQL-Dateien + Cross-DB-Smoke ergänzen | P0 | D |
| GAP-AUTHZ-001 | Security | Business-Endpunkte ohne Projekt-/Rollen-Gates | AuthZ Middleware/Service einführen | P0 | D |
| GAP-API-001 | API | Große Router-/Store-Dateien | Routen, Validatoren, Store-Module splitten | P1 | D |
| GAP-API-002 | API | Keine Pagination/Limits; Issue-Filter aktuell UI-seitig | Query-DTOs für URL/Issue/Crawl-Listen | P1 | C/D |
| GAP-SEC-001 | Dependencies | Next/PostCSS moderate Audit Findings | gezieltes Upgrade/Risk Assessment, kein blindes `--force` | P1 | D |
| GAP-CRAWL-001 | Crawl | Regex-HTML-Heuristiken und nur minimale Robots-Policy | Parser/Robots/Sitemap-Index robust machen | P1 | B/D |
| GAP-LINK-001 | Crawl | Interner Linkgraph fehlt | Link Extraction + Edge Table + Depth/Orphan-Auswertung | P1 | Welle 2+ |
| GAP-OBS-001 | Observability | Job-/Run-Korrelation minimal | structured logs + runId/jobId/requestId | P1 | D |
| GAP-WV-001 | Audit | Web Vitals fehlt | Lighthouse/PSI Stub und spätere Provider-Abstraktion | P2 | Welle 2+ |
| GAP-MOD-001 | Produktmodule | Wellen 3–7 nur Navigation/Specs | nach Welle-2-Gate Keyword Core starten | P2 | Welle 3 |

## 7. Abschlusskriterien bis App-MVP

Die App ist erst MVP-ready, wenn alle folgenden Punkte erfüllt sind:

- Welle-1-Gate per UI-Smoke bestanden.
- Welle-2-Gate per Worker-Crawl auf Fixture und mindestens einer echten eigenen Site bestanden.
- Technical-Audit UI zeigt Runs, URLs, Issues und Health Score aus SQLite/API.
- API-Listen sind paginiert oder explizit limitiert.
- Mutations sind authentifiziert und projektbezogen autorisiert.
- Migrationen sind versioniert und lokal reproduzierbar.
- Dependency-Audit-Entscheidung ist umgesetzt oder dokumentiert akzeptiert.
- `npm run check` und Web-Build laufen grün.

## 8. Aktuelle Prozent-Einschätzung

- Welle 1 Backend: 75–85 %
- Welle 1 End-to-End inkl. UI: 45–55 %
- Welle 2 Contracts/Persistenz/API: 65–75 %
- Welle 2 echter Crawl-Betrieb/UI: 25–35 %
- Gesamt-App Richtung intern nutzbarer MVP: 30–40 %

Diese Prozentwerte sind bewusst grob. Sie messen nicht Lines of Code, sondern Gate-Fähigkeit: Kann ein Nutzer den geplanten Workflow ohne Entwickler-/API-Handarbeit ausführen?
