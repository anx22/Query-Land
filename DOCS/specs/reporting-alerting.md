# Module Spec: Reporting & Alerts

> Verfeinert: Modul 6 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 6 geschärft.

## Purpose
SEO-Steuerung ohne Dashboard-Rauschen; management-tauglich.

## Scope
Report-Typen (Weekly Pulse, Technical Health, Search Performance, Content Opportunity, Rank, Competitor, Indexability, Backlink, Performance-Regression); Report-Struktur (Summary…Next Actions); PDF/CSV; E-Mail/Slack; Alert-Typen.

## Non-Scope
Erzeugt keine neuen Empfehlungen (kommen aus §6/M4).

## Data Sources
Alle Module + Opportunities.

## Entities
`report · alert`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Alert-Schwellen pro Typ.

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Dashboards, Report-Builder, Alert-Settings.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Wochenreport automatisiert (Gate Welle 6, §10).

## Future Extensions
Custom-Report-Templates.

## Cross-Refs
§5/M6, §6
