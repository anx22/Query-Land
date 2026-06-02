# Module Spec: Content & Opportunity Engine

> Verfeinert: Modul 4 (§5) + Opportunity-Kern (§6) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 4 geschärft.

## Purpose
Der ROI-Moment: aus Messung priorisierte, source-anchored, validierbare Arbeit (§2.2, §6).

## Scope
GSC-Search-Performance-Intelligence (Query-Page-Matrix, Gaps, Decay, Gewinner/Verlierer); Content-Inventar/-Decay; Refresh-Kandidaten; Content-Gap; Intent-Fit; Title/Snippet; interne Linkvorschläge; Briefing-Generator; fünf Opportunity-Klassen (technische Fixes, Low-Hanging Keywords, Kannibalisierung, Money-Pages, Internal-Link-Lücken).

## Non-Scope
LLM erklärt/formuliert, misst nicht (§2.8).

## Data Sources
GSC (B), Crawl (A), SERP (C), Source-Map (A), Business-Wert (M1).

## Entities
`opportunity · evidence · content_recommendation · page_metric`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Prioritätsformel §6.4; Evidenz §6.3; Validierungsloop §6.5; erster Generator §6.6 (technischer Fix, binär).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Opportunity Board (Filter, Evidence Drawer, Validation Drawer), Content Workspace, URL Dossier.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Jede Empfehlung mit Evidenz + Score + Validierungsmetrik; erster Generator validiert real (Gate Welle 4, §10).

## Future Extensions
LLM-Briefing-Ausbau (V2), automatischer Fix-PR (§4.4).

## Cross-Refs
§5/M4, §6 komplett, §4.3, §2.2/§2.8
