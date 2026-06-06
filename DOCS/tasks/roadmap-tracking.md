# Roadmap Tracking — Bestandsaufnahme, Gates und nächste Sprints

> Zweck: offizielles Tracking-Dokument für den aktuellen Implementierungsstand nach der Foundation- und Crawl-Pipeline-Arbeit. Dieses Dokument ergänzt `docs/PRODUCT_MASTER_SPEC.md` §10 und die Wave-Backlogs in `tasks/`.
>
> Stand: 2026-06-05 · Quelle: Code-/Test-Bestandsaufnahme inklusive Worker-v0- und Technical-Audit-UI-Slice.

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
| Crawler/Worker Core | 55–65 % | Worker v0 claimt Jobs und erzeugt Crawl-Artefakte | Robustheit, echte Site-Smokes, Betrieb/Daemon, Robots/Sitemap-Details |
| Frontend Produkt-UI | 45–55 % | Foundation-/Technical-Audit-Flows nutzen echte API-Daten; Technical-Audit-Issue-Aktionen sind bedienbar; UI bleibt v0 | Detail Drawer, weitere serverseitige Filter, Foundation-Smokes |
| Observability/Ops/Security | 15–25 % | erste Health-/Log-Basis | Request-/Job-Tracing, Audit-Fix, Secrets/AuthZ |
| Gesamt-App | 40–50 % | vertikaler Welle-1/2-Schnitt erkennbar, Gate noch nicht bewiesen | echte Site-Smokes, Härtung, AuthZ, Migrationen |

## 3. Befund der Fehlerprüfung

### 3.1 Grüne Checks

- `npm run check` läuft aktuell grün: TypeScript-Typecheck, Workspace-Boundary-Check, OpenAPI-Strukturvalidierung und Node-Test-Suites bestehen.
- Die API-/Store-Tests decken Foundation, Auth, Jobs und Crawl-Artefakte ab: Discovery, Fetch Results, Indexability, Audit Issues, Health Scores und Crawl Runs.
- OpenAPI wird strukturell validiert und enthält die neuen Crawl-Endpunkte.

### 3.2 Rote / gelbe Befunde

- `npm audit --audit-level=moderate` meldet 2 moderate Findings über Next/PostCSS. `npm audit fix --force` würde laut npm einen Breaking-Downgrade installieren und ist deshalb nicht automatisch anzuwenden.
- Die Web-App nutzt für Foundation-/Technical-Audit-Flows echte API-/SQLite-Daten, aber Gate-Smokes, Pagination und Details sind noch nicht vollständig.
- `services/crawler` hat Worker-v0-Funktionalität, ist aber noch nicht robust als Betriebskomponente für echte Sites nachgewiesen.
- SQLite-Schema ist ein großer idempotenter SQL-String; ein versioniertes Migrationssystem fehlt.
- API-Routing, Request-Validierung und Store-Persistenz wachsen in wenigen großen Dateien und müssen vor weiterem Ausbau modularisiert werden.
- Business-Endpunkte sind noch nicht projekt-/rollenbasiert geschützt; Auth existiert, AuthZ-Gates fehlen.
- Crawler-Heuristiken nutzen einfache Regex-Extraktion für HTML-Metadaten; robustes HTML-/Robots-/Sitemap-Parsing fehlt.

## 4. Wave-Status gemäß Master §10

### 4.1 Welle 1 — Foundation Gate schließen

**Master-Gate:** Domain anlegen, Crawl starten, GSC/GA4 verbinden.

| Slice | Backend | UI | Status | Offene Lücke |
|---|---|---|---|---|
| Project/Site persistieren | vorhanden | echte API-Formulare/Listen vorhanden | in_progress | UI-Smoke, Validierungsdetails und Rollen-/Scope-Gates fehlen |
| GSC/GA4 Stub + Sync Job | vorhanden | Connector-UI nutzt echte API-Zustände | in_progress | Job-Planung/Sync-Smoke und OAuth-Produktionspfad fehlen |
| Crawl Seed Job starten/status verfolgen | Queue + Crawl Runs vorhanden; `crawl-runs/schedule` erstellt Run + typed `crawl_seed` Job; Worker v0 kann `crawl_seed` claimen, Legacy-Payloads ohne `crawlRunId` ergänzen, Artefakte schreiben und Runs abschließen | Teilweise | worker_v0_stabilisieren | Gate-Smoke gegen Fixture und echte Site, Robots-Details und Betrieb fehlen |
| Source Map Refresh + Mapping anzeigen | Listing vorhanden | echte API-Daten sichtbar | in_progress | Refresh-Job-Smoke und Mapping-Detailansicht fehlen |

**Welle-1-Entscheidung:** Backend und erste echte UI-/Worker-Anbindung sind weitgehend vorhanden. Das Gate ist erst geschlossen, wenn UI-Smokes die echten API-Flows reproduzierbar nachweisen.

### 4.2 Welle 2 — Audit Core nutzbar machen

**Master-Gate:** 95 % stabile Vollcrawls auf eigenen Sites.

| Slice | Aktueller Stand | Status | Offene Lücke |
|---|---|---|---|
| URL Discovery v0 | Domain/API/DB/Tests und Worker-v0-Persistenz vorhanden | in_progress | echte Sitemap-/Seed-Smokes, Sitemap-Index und Scope-Robustheit fehlen |
| HTTP Fetch Worker v0 | Normalisierungslogik, Persistenz und Worker-v0-Ausführung vorhanden | in_progress | Retry/Timeout robuster machen und echte Site-Smokes nachweisen |
| Indexability Checks v0 | Klassifikation, Persistenz, Worker-Integration und URL-Explorer-Anzeige vorhanden | in_progress | Detail Drawer und Edge-Cases fehlen |
| Issue Rules Minimum Set | Rules + Persistenz, Resolve-Endpoint, UI-Filter und Issue-Tabelle vorhanden | in_progress | Pagination, serverseitige Filter und Reopen/Dismiss fehlen |
| Health Score v0 | Score + Snapshots, Worker-Berechnung und Score-UI vorhanden | in_progress | automatische Recompute-Policy fehlt |
| Crawl Runs | Lifecycle + Summary vorhanden; Worker v0 schließt Fixture-Runs mit Artefakten ab; UI listet Runs | in_progress | Daemon/Betrieb und echte Site-Robustheit fehlen |
| Interner Linkgraph | nicht implementiert | todo | Link-Extraktion, Edges, Depth, Orphans |
| Robots/Sitemap robust | erster robots.txt-Disallow-Filter + Scope-Policy vorhanden | in_progress | Crawl-delay/User-Agent-Gruppen, Sitemap-Index |
| Web Vitals | nicht implementiert | todo | PSI/Lighthouse Connector oder Stub |

**Welle-2-Entscheidung:** Der API-/Persistenzkern plus Worker-v0 und Technical-Audit-UI reichen für einen vertikalen Slice. Der nächste Schwerpunkt ist Stabilisierung, echte Site-Smokes und Bedienhärtung statt weiterer Tabellen.

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

### Sprint B — Worker stabilisieren und Gate nachweisen

**Ziel:** Worker v0 von einem funktionierenden Slice zu einem reproduzierbaren Welle-2-Gate mit Fixture- und echter-Site-Smokes härten.

**Scope:**

1. Bestehenden `crawl_seed`-Worker-v0 als wiederholbaren Fixture-Smoke dokumentieren und automatisieren.
2. Echte eigene Test-Site als Smoke-Ziel definieren und Run-Kriterien festhalten.
3. Retry-/Timeout-/Failure-Modes für Network Error, ungültige Sitemap und Robots-Blocker härten.
4. Robots-/Sitemap-Details inklusive Sitemap-Index und User-Agent-Gruppen ausbauen.
5. Betriebsmodus klären: Startscript/Daemon, Logs, Run-/Job-Korrelation und Exit-/Retry-Verhalten.

**Nicht-Scope:** JS Rendering, Vollcrawl >5k, externes Scheduling, Web Vitals.

**Done-Gate:** Fixture-Crawl und mindestens ein Crawl auf einer echten eigenen Site laufen end-to-end durch Worker v0, erzeugen persistierte Artefakte plus Crawl-Run-Summary und sind über Logs/Run-Status nachvollziehbar. Offen dokumentierte Restrisiken dürfen nicht das Welle-2-Gate blockieren.

### Sprint C — Technical Audit UI v0

**Ziel:** Bestehende Technical-Audit-UI von v0-Transparenz zu operativer Nutzbarkeit härten.

**Aktueller Stand:** Technical-Audit-UI zeigt bereits Crawl Runs, Health, Issues und einen URL Explorer aus echten API-/SQLite-Daten.

**Scope:**

1. Pagination oder harte Limits für Crawl Runs, URL Explorer und Issue-Liste.
2. URL-/Issue-Detail Drawer mit Fetch-, Indexability-, Rule- und Run-Kontext.
3. Serverseitige Filter für Issue-Status, Severity, Rule, URL und Run/Site-Kontext.
4. Issue-Aktionen vervollständigen: Reopen und Dismiss zusätzlich zu Resolve. **Status 2026-06-06:** API- und UI-Aktionen für Resolve, Dismiss und Reopen vorhanden; Technical-Audit-Start läuft über eine gemeinsame `crawl-runs/schedule` Seam. Getrennte Dismiss-Reason-Historie bleibt offen.
5. Empty/Error/Loading States für die neuen Listen-/Detailzustände nachziehen.

**Nicht-Scope:** Deep Segmentation, Export, Alerts, Web Vitals.

**Done-Gate:** User kann Crawl starten, Runs/Health/URLs/Issues paginiert durchsuchen, Detailkontext öffnen und Issues per Resolve/Reopen/Dismiss ohne manuelle API-Aufrufe bearbeiten.

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
| GAP-WORKER-001 | Crawler | Worker v0 vorhanden; Robustheit, echte Site-Smokes und Betrieb fehlen | Worker stabilisieren, Fixture-/echte-Site-Gate nachweisen und Betriebsmodus klären | P0 | B |
| GAP-MIG-001 | DB | SQLite-Migration Runner vorhanden; Postgres-Migrationen fehlen | Postgres SQL-Dateien + Cross-DB-Smoke ergänzen | P0 | D |
| GAP-AUTHZ-001 | Security | Business-Endpunkte ohne Projekt-/Rollen-Gates | AuthZ Middleware/Service einführen | P0 | D |
| GAP-API-001 | API | Große Router-/Store-Dateien | Routen, Validatoren, Store-Module splitten | P1 | D |
| GAP-API-002 | API | Pagination/Limits fehlen; Issue-/URL-Filter sind noch nicht serverseitig vollständig | Query-DTOs für URL/Issue/Crawl-Listen | P1 | C/D |
| GAP-SEC-001 | Dependencies | Next/PostCSS moderate Audit Findings | gezieltes Upgrade/Risk Assessment, kein blindes `--force` | P1 | D |
| GAP-CRAWL-001 | Crawl | Regex-HTML-Heuristiken und nur minimale Robots-Policy | Parser/Robots/Sitemap-Index robust machen | P1 | B/D |
| GAP-LINK-001 | Crawl | Interner Linkgraph fehlt | Link Extraction + Edge Table + Depth/Orphan-Auswertung | P1 | Welle 2+ |
| GAP-OBS-001 | Observability | Job-/Run-Korrelation minimal | structured logs + runId/jobId/requestId | P1 | D |
| GAP-WV-001 | Audit | Web Vitals fehlt | Lighthouse/PSI Stub und spätere Provider-Abstraktion | P2 | Welle 2+ |
| GAP-MOD-001 | Produktmodule | Wellen 3–7 nur Navigation/Specs | nach Welle-2-Gate Keyword Core starten | P2 | Welle 3 |
| GAP-DOC-001 | Domain-Dokumentation | `CONTEXT.md` ist neu und muss bei Architekturentscheidungen mitgeführt werden | Neue load-bearing Domain-Begriffe aus Reviews sofort in `CONTEXT.md` und passende Task-/Spec-Dokumente übernehmen | P1 | laufend |
| GAP-SMOKE-001 | Deployment-Smoke | Production Smoke Target ist definiert, aber noch nicht automatisiert | Browser-/Log-Smokes gegen `https://queryland-inky.vercel.app/` als manuelles Gate dokumentieren und später automatisieren | P1 | B/C |

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

- Welle 1 Backend: 80–90 %
- Welle 1 End-to-End inkl. UI: 60–70 %
- Welle 2 Contracts/Persistenz/API: 75–85 %
- Welle 2 Worker-v0/Technical-Audit-UI: 60–70 %
- Welle 2 echtes Betriebsgate: 40–50 %
- Gesamt-App Richtung intern nutzbarer MVP: 40–50 %

Diese Prozentwerte sind bewusst grob. Sie messen nicht Lines of Code, sondern Gate-Fähigkeit: Kann ein Nutzer den geplanten Workflow ohne Entwickler-/API-Handarbeit ausführen?
