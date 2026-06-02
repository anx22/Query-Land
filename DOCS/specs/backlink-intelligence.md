# Module Spec: Backlink & Authority

> Verfeinert: Modul 5 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 5 geschärft.

## Purpose
Autoritätssignale eigener Domains in die Priorisierung einbinden — right-sized.

## Scope
GSC-Link-Import (Primär, B); optional Backlink-Provider (D); Referring Domains, Anchors, Target-URLs, New/Lost (wöchentlich), Broken Targets, Link-Intersect (optional), Authority-Verteilung/-Gaps, Disavow-Kandidaten (manuell).

## Non-Scope
Kein globaler Backlink-Index (§A.2); keine automatische Disavow-Logik.

## Data Sources
GSC Links (B), optional Provider (D), manuelle Listen (A).

## Entities
`backlink · ref_domain · link_event`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Authority Delta (§8); Risk-Review nur manuell.

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Linkprofil, New/Lost, Broken Targets, Authority-Gaps.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Neue/verlorene Links nachvollziehbar (Gate Welle 5, §10).

## Future Extensions
Outreach-Workflow.

## Cross-Refs
§5/M5, §A.2, §8
