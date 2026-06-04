# Welle-2 Audit-Core Story Seeds

> Status nach Bestandsaufnahme 2026-06-03: Domain/API/SQLite/OpenAPI/Test-Contracts sind für die Minimum-Slices weitgehend vorhanden. Das Welle-2-Gate ist aber erst erreicht, wenn ein Worker die Pipeline end-to-end ausführt und die Technical-Audit-UI die Ergebnisse sichtbar macht. Details: `roadmap-tracking.md`.

## W2-AUDIT-001 — URL Discovery v0

- **Status:** contract_done
- **Scope:** Start-URL + sitemap discovery; persist discovered URLs.
- **Vorhanden:** `DiscoveredUrl`, `discovered_urls`, API list/record, Crawler-Sitemap-Discovery, Tests.
- **Offene Lücke:** Worker muss echte Sitemap/Seed-Daten schreiben; UI URL Explorer fehlt.
- **Acceptance:** Given a fixture sitemap, crawler stores URLs with source metadata.

## W2-AUDIT-002 — HTTP Fetch Worker v0

- **Status:** contract_done
- **Scope:** Fetch URLs from queue, store status, headers, final URL.
- **Vorhanden:** Fetch-Normalisierung, `UrlFetchRecord`, `url_fetch_results`, API list/record, Tests.
- **Offene Lücke:** Queue-Worker mit Timeout/Retry/Failure Modes fehlt.
- **Acceptance:** 200/3xx/4xx fixture responses are normalized.

## W2-AUDIT-003 — Indexability Checks v0

- **Status:** contract_done
- **Scope:** robots meta, X-Robots, canonical and status-code classification.
- **Vorhanden:** `IndexabilityRecord`, `url_indexability_assessments`, API list/record, Crawler-Klassifikation, Tests.
- **Offene Lücke:** Worker-Integration und UI-Detailansicht fehlen; Parser ist noch heuristisch.
- **Acceptance:** Each fixture URL receives deterministic indexability state.

## W2-AUDIT-004 — Issue Rules Minimum Set

- **Status:** contract_done
- **Scope:** HTTP error, redirect chain, missing title, duplicate title, canonical mismatch, broken link.
- **Vorhanden:** `AuditIssueRecord`, `crawl_audit_issues`, API list/record, Rule-Evaluation, Tests.
- **Offene Lücke:** Issue-Lifecycle UI, Filter/Pagination und Resolve-Aktion fehlen.
- **Acceptance:** Rule tests map fixture inputs to issue severity.

## W2-AUDIT-005 — Health Score v0

- **Status:** contract_done
- **Scope:** Compute simple weighted score from issue severities.
- **Vorhanden:** `CrawlHealthScore`, `crawl_health_scores`, compute/list API, Tests.
- **Offene Lücke:** automatische Recompute-Policy und UI-Karte fehlen.
- **Acceptance:** Score changes predictably when critical issues are added/removed.

## W2-AUDIT-006 — Crawl Run Lifecycle v0

- **Status:** contract_done
- **Scope:** Create/list/complete crawl runs and snapshot crawl artifact counters.
- **Vorhanden:** `CrawlRun`, `crawl_runs`, API create/list/complete, Summary-Counter, Tests.
- **Offene Lücke:** Runs sind noch nicht hart mit einem echten Worker-Artefaktfluss gekoppelt.
- **Acceptance:** Completing a crawl run records discovered URL, fetch, indexability, open issue and latest health score counters.

## W2-AUDIT-007 — Crawl Worker v0

- **Status:** in_progress
- **Scope:** Claim crawl jobs, execute fixture/seed/sitemap pipeline, persist artifacts, compute health, complete run.
- **Umgesetzt:** `crawl_seed` Jobs transportieren jetzt `subject`/`payload`; die API kann Jobs claimen und abschließen; `services/crawler` hat einen Worker-Cycle und einen HTTP-Worker-Prozess (`npm --workspace @seo-tool/crawler run start:once`), der Fixture-Sitemap, Fetch, Indexability, Issues, Health und Run-Completion end-to-end gegen die API ausführt. Retry/Timeout und Same-Host-Scope-Filter sind für den Worker-Slice abgedeckt.
- **Offene Lücke:** Robots.txt-Policy, breitere Network-Error-Klassifikation und Smoke gegen eine echte eigene Site.
- **Acceptance:** A fixture crawl creates a crawl run and persists discovered URLs, fetch results, indexability assessments, audit issues and health score without manual API calls.
- **Test gate:** Worker integration test against `sqlite::memory:` plus failure-mode tests for network error and invalid sitemap.

## W2-AUDIT-008 — Technical Audit UI v0

- **Status:** ready
- **Scope:** Crawl Runs list, Health Score card, URL Explorer and Issue table using real API data.
- **Acceptance:** User can start a crawl and inspect URLs/issues/health without direct API calls.
- **Test gate:** UI smoke + API fixture state.

## Welle-2 Gate-Entscheidung

- Contract-/Persistenzkern ist weit genug, um auf Worker+UI umzuschalten.
- Nächste Sprint-Fokusse: `roadmap-tracking.md` Sprint B und Sprint C.
- Gate gilt erst als bestanden, wenn ein stabiler Crawl auf Fixture und mindestens einer eigenen Site wiederholbar läuft.
