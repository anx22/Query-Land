# Module Spec: Issue Rules

> Verfeinert: Modul 2 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 2 geschärft.

## Purpose
Technische Prüfregeln und Severity-Logik, die Crawl-Daten in Issues übersetzen.

## Scope
Regelkatalog: HTTP-Status, Redirects, Canonicals, Meta/X-Robots, robots.txt, Sitemaps, Title/Meta/Headings, Links, Broken Links, Images/Alt, Structured Data, hreflang, Pagination, Duplicate/Thin, Mixed Content/HTTPS, Web Vitals (LCP/CLS/INP/TTFB).

## Non-Scope
Keine Priorisierung der Geschäftsrelevanz (das tut §6.4).

## Data Sources
crawl_run-Ergebnisse, PSI/Lighthouse.

## Entities
`issue · issue_instance` · `IssueDefinition (code, category, severity, detection_logic, recommendation_template, validation_logic)`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Severity (error/warning/notice/opportunity); Issue-Priorität fließt in §6.4 ein.

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Issue Groups, URL-Detail-Issues.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Regelkatalog als JSON-Schema; Testfälle pro Regel.

## Future Extensions
Erweiterbarer Regelsatz.

## Cross-Refs
§5/M2, §6.4, specs/crawl-engine.md
