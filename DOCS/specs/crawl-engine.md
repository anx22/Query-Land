# Module Spec: Crawl Engine

> Verfeinert: Modul 2 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Teilimplementiert — Contracts/Persistenz/API vorhanden; Worker und UI noch offen. Roadmap: `../tasks/roadmap.md`.

## Purpose

Technisches Rückgrat: belastbarer Crawl als Basis für Aufgaben, Scores, Priorisierung.

## Scope

Crawl-Queue; vier Discovery-Quellen (Start-URL, interne Links, Sitemaps, First-Party); Scopes; JS-Rendering als Projekt-Flag (§A.3); Vollcrawl (<5k URLs); Crawl-Diff zwischen Läufen und gegen Deploy-Marker; Orphan-/Deep-URL-Erkennung; interner Linkgraph.

## Current Implementation Snapshot

Vorhanden:

- Domain-Verträge für `CrawlRun`, `DiscoveredUrl`, `UrlFetchRecord`, `IndexabilityRecord`, `AuditIssueRecord`, `CrawlHealthScore`.
- SQLite-Tabellen für Crawl Runs, entdeckte URLs, Fetch Results, Indexability Assessments, Audit Issues und Health Scores.
- API-Endpunkte für create/list/record/compute der genannten Artefakte in `openapi/internal-api.yaml`.
- Crawler-Service-Helfer für URL-Normalisierung, Sitemap-Discovery, Fetch-Normalisierung, Indexability-Klassifikation und Minimum-Issue-Rules.
- Tests für Domain/API/Crawler-Minimum-Flows.

Noch offen:

- Worker, der `job_queue` claimt und die Pipeline ohne manuelle API-Aufrufe ausführt.
- Robustes `robots.txt`-/Sitemap-Index-/HTML-Parsing.
- Interner Linkgraph, Depth/Orphan-Auswertung und Segmentanalyse.
- Technical-Audit-UI mit URL Explorer, Runs, Issues und Health Score.
- Retry/Timeout/Rate-Limit/Politeness-Regeln.

## Non-Scope

Kein Sampling (nicht nötig <5k); kein Crawl fremder Domains außer ratenbegrenzter Wettbewerbskontext (M4-Anschluss).

## Data Sources

Eigene Sites; Sitemap/robots; Deploy-Marker (§4.3). In Welle 2 v0 zuerst Fixture-Sitemap und eigene Site-Scopes.

## Entities

Implementiert:

- `crawl_runs`
- `discovered_urls`
- `url_fetch_results`
- `url_indexability_assessments`
- `crawl_audit_issues`
- `crawl_health_scores`

Geplant/nachzuziehen:

- `internal_links`
- `link_graph_edges`
- `anchor_texts`
- `url_depth_snapshots`
- `hub_pages`
- `orphan_pages`
- Crawl-Diff-Tabellen gegen vorherige Runs und Deploy-Marker

## Processing Pipeline

Ziel-Pipeline Welle 2 v0:

1. UI/API erstellt Crawl Run oder `crawl_seed` Job.
2. Worker claimt Job idempotent aus `job_queue`.
3. Worker entdeckt URLs aus Seed und Sitemap und schreibt `discovered_urls`.
4. Worker fetched URLs mit Timeout/Retry und schreibt `url_fetch_results`.
5. Worker bewertet Indexability und schreibt `url_indexability_assessments`.
6. Worker erzeugt Minimum-Issues und schreibt `crawl_audit_issues`.
7. Worker berechnet `crawl_health_scores`.
8. Worker schließt `crawl_runs` mit Summary-Countern ab und setzt Job-Status.

Failure Modes, die vor Gate abzudecken sind:

- Network Error → Fetch Result `network_error`, Job/Run bleibt nachvollziehbar.
- Ungültige Sitemap → Job/Run `failed` mit `last_error`/`errorMessage`.
- Out-of-scope URL → nicht crawlen; der Worker filtert aktuell auf gleiche Protocol-/Host-Scope vor Persistenz.
- Duplicate URL → Upsert über normalisierte URL.
- Network Retry/Timeout → `fetchUrl` unterstützt deterministische Retry-/Timeout-Optionen; der HTTP-Worker setzt Default-Timeout/Retry per Environment.

## Scoring / Classification

Aktuell implementiert:

- Fetch Status Classes: `success`, `redirect`, `client_error`, `server_error`, `network_error`.
- Indexability States: `indexable`, `blocked_by_status`, `blocked_by_meta`, `blocked_by_x_robots`, `canonicalized`.
- Issue Rules: `http_error`, `redirect_chain`, `missing_title`, `duplicate_title`, `canonical_mismatch`, `broken_link`.
- Health Score: gewichteter Penalty-Score aus offenen Issues.

Nachzuziehen:

- Linkgraph-basierte Regeln: Deep URL, Orphan URL, broken internal links nach Linkquelle.
- Robustere Robots.txt-Details: Crawl-delay, mehrere User-Agent-Gruppen, Sitemap-Direktiven und persistierte Robots-Evidence.
- Canonical-Cluster und Duplicate-Content-Heuristiken.
- Web-Vitals als separater Signaltyp.

## API Endpoints

Aktuell im OpenAPI-Vertrag enthalten:

- `GET/POST /projects/{projectId}/sites/{siteId}/crawl-runs`
- `POST /projects/{projectId}/sites/{siteId}/crawl-runs/{crawlRunId}/complete`
- `GET/POST /projects/{projectId}/sites/{siteId}/discovered-urls`
- `GET/POST /projects/{projectId}/sites/{siteId}/discovered-urls/{discoveredUrlId}/fetch-results`
- `GET/POST /projects/{projectId}/sites/{siteId}/discovered-urls/{discoveredUrlId}/indexability`
- `GET/POST /projects/{projectId}/sites/{siteId}/audit-issues`
- `GET /projects/{projectId}/sites/{siteId}/health-scores`
- `POST /projects/{projectId}/sites/{siteId}/health-scores/compute`

Nachzuziehen:

- Query-Parameter für Pagination/Filter/Sort.
- Start-Crawl-Endpunkt oder Job-typed Command, der Worker-Orchestrierung auslöst.
- Resolve-Issue-Endpunkt ist vorhanden; Reopen/Dismiss fehlen noch.
- Linkgraph-/URL-Explorer-Endpunkte.

## UI Screens

MVP-Screens für Sprint C:

- Crawl Runs: Liste, Status, Trigger, Summary, Start/Finish.
- Health Score: letzter Score, Trend, Severity Counts.
- URL Explorer: Discovered URLs mit latest Fetch und Indexability ist in der Technical-Audit-Seite angebunden; Detail Drawer fehlt noch.
- Issue Table: Severity, Rule, URL, Status, Filter und Resolve-Aktion.
- Detail Drawer: Fetch Headers, Redirect Chain, Reasons, Canonical.

## States

Crawl Run:

- `queued` — vorgesehen, aber aktuell create startet direkt `running`; mit Worker-Orchestrierung wieder aktivieren.
- `running` — Run angelegt, Pipeline läuft.
- `succeeded` — Pipeline abgeschlossen und Summary gespeichert.
- `failed` — Pipeline abgebrochen; Fehler in `errorMessage`.

Job Queue:

- `queued → running → succeeded|failed|cancelled`.

Issue Lifecycle:

- Aktuell: offen, wenn `resolvedAt = null`; resolved, wenn `resolvedAt != null`.
- Aktuell: `resolve` per API/UI; nachzuziehen: `reopen`, `dismiss`.

## Error Handling

- API gibt stabile `ApiError`-Antworten mit `code`, `message`, optional `details`, `requestId`.
- Store prüft Projekt-/Site-/Discovered-URL-/Fetch-Result-Scope vor Writes.
- Worker muss Fehler zusätzlich auf Job- und Crawl-Run-Ebene persistieren.

## Observability

Aktuell:

- Request-Logs mit Request-ID im API-Prozess.
- Audit Logs für Store-Aktionen.

Nachzuziehen:

- `jobId`, `crawlRunId`, `projectId`, `siteId` in allen Worker Logs.
- Run-Dauer, URL/s, Error-Counts, Retry-Counts.
- Health-/Readiness-Signale für Worker.

## Acceptance Tests

Welle-2 Gate:

- Fixture-Crawl erzeugt Crawl Run, URLs, Fetch Results, Indexability, Issues und Health Score.
- Network Error und ungültige Sitemap sind deterministisch getestet.
- Robots.txt-Disallow wird als `blocked_by_robots` Indexability Assessment ohne Page-Fetch persistiert.
- Out-of-scope Sitemap-URLs werden nicht persistiert/gefetches.
- Duplicate URLs werden idempotent verarbeitet.
- Technical-Audit-UI zeigt Run, URLs inklusive latest Fetch/Indexability, Issues und Health Score aus echter API.
- Wiederholter Crawl auf eigener Site ist stabil genug für das Master-Gate: 95 % stabile Vollcrawls auf eigenen Sites.

## Future Extensions

- Inkrementeller Recrawl nur geänderter Routen via Source-Map.
- JS Rendering pro Projekt-Flag.
- Crawl-Diff gegen Deploy-Marker.
- Linkgraph/Orphan/Deep-URL-Analysen.
- Web-Vitals/PSI/Lighthouse-Signale.

## Cross-Refs

§5/M2, §4.3, specs/issue-rules.md, specs/source-map.md, tasks/roadmap.md
