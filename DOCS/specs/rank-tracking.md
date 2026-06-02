# Module Spec: Rank & SERP Tracking

> Verfeinert: Modul 3 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 3 geschärft.

## Purpose
Überwachung wichtiger Rankings und SERP-Veränderungen auf dem eigenen Keyword-Set.

## Scope
Keyword-Tracking (täglich/wöchentlich, Land/Sprache/Device/Suchmaschine); SERP-Snapshots inkl. Features; eigene URL- und Wettbewerber-Erkennung; Ranking-Volatilität; Kannibalisierung; SERP-Diff; SERP-Share.

## Non-Scope
Kein unkontrolliertes Scraping; SERP nur über saubere, ratenbegrenzte Quellen (Compliance).

## Data Sources
SERP-Provider (C/D), eigene Rankings (B).

## Entities
`rank_snapshot · serp_snapshot` (keyword, market, device, timestamp, ranking_urls/domains, own_position, serp_features, competitor_domains)

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Eingang in Visibility-Index (specs/visibility-index.md).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Ranking-Historie, SERP-Diff, Wettbewerber-Share.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Tägliche Verläufe, Export, Alerts (Gate Welle 3, §10).

## Future Extensions
Mehr Märkte/Devices.

## Cross-Refs
§5/M3, specs/visibility-index.md, specs/keyword-intelligence.md
