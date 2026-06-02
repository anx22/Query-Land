# Module Spec: Observability & SRE

> Verfeinert: §4.1 (Foundation) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 1 geschärft.

## Purpose
Fehler sichtbar machen, Jobs überwachen (§4.1, §12.4).

## Scope
Logging, Tracing, Error-Tracking, Job-Monitoring, Feature-Flags.

## Non-Scope
Keine SEO-Logik.

## Data Sources
Alle Services/Worker.

## Entities
—

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
—

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Job-/Fehler-Monitoring.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Jobs idempotent, Fehler sichtbar.

## Future Extensions
SLO-Dashboards.

## Cross-Refs
§4.1, §12.4
