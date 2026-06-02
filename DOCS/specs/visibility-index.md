# Module Spec: Visibility Index

> Verfeinert: Modul 3 (§5, §8) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 3 geschärft.

## Purpose
Projektspezifischer Sichtbarkeitsindex (eigener 'Monitoring-OVI') als verdichtete Steuerungs-KPI (§2.5, §8).

## Scope
Formel, Gewichtungen (Position × Suchvolumen/Business-Wert × Set-Zugehörigkeit), Beispielrechnungen, historischer Verlauf.

## Non-Scope
Kein globaler Marketing-Score über fremde Domains.

## Data Sources
rank_snapshot, keyword_group, Business-Wert (M1).

## Entities
`visibility_score`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Kern dieser Spec — transparente, dokumentierte Formel.

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Visibility-Verlauf im Project Overview.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Reproduzierbare Beispielrechnung; Verlauf über Zeit.

## Future Extensions
Segment-Visibility pro URL-Gruppe.

## Cross-Refs
§5/M3, §8, specs/rank-tracking.md
