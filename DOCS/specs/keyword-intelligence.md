# Module Spec: Keyword & Topic Intelligence

> Verfeinert: Modul 3 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 3 geschärft.

## Purpose
Kuratiertes, relevantes Keyword-/Themen-Universum statt kosmetischer Datenmasse (§2.5).

## Scope
Keyword-Bibliothek (GSC-Queries, bestehende Rankings, manuelle Business-Keywords, Themencluster, optional Wettbewerberlücken); Keyword-/Topic-Clustering; Intent-Klassifikation; Brand/Non-Brand; Funnel-Stage; URL-Mapping; Keyword-/Themen-Gap.

## Non-Scope
Keine globale Milliarden-Keyword-DB in V1 (§A.2).

## Data Sources
GSC (B), manuell (A), optional Keyword-Provider (D), SERP-Snapshots (C).

## Entities
`keyword · keyword_group · Topic · Intent · TargetURL · SERPFeature`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Keyword-Priorisierung; Intent-Klassen (§5/M3).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Themenlandkarte, Cluster, Keyword-Set-Verwaltung.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Keyword-Set geclustert, Intent-getaggt, URL-gemappt.

## Future Extensions
Trends-/Provider-Anbindung.

## Cross-Refs
§5/M3, §2.5, specs/rank-tracking.md, specs/visibility-index.md
