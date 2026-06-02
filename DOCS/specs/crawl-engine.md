# Module Spec: Crawl Engine

> Verfeinert: Modul 2 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 2 geschärft.

## Purpose
Technisches Rückgrat: belastbarer Crawl als Basis für Aufgaben, Scores, Priorisierung.

## Scope
Crawl-Queue; vier Discovery-Quellen (Start-URL, interne Links, Sitemaps, First-Party); Scopes; JS-Rendering als Projekt-Flag (§A.3); Vollcrawl (<5k URLs); Crawl-Diff zwischen Läufen und gegen Deploy-Marker; Orphan-/Deep-URL-Erkennung; interner Linkgraph.

## Non-Scope
Kein Sampling (nicht nötig <5k); kein Crawl fremder Domains außer ratenbegrenzter Wettbewerbskontext (M4-Anschluss).

## Data Sources
Eigene Sites; Sitemap/robots; Deploy-Marker (§4.3).

## Entities
`crawl_run · url · InternalLink · LinkGraph · AnchorText · UrlDepth · HubPage · OrphanPage`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Indexierbarkeits-Pipeline (gefunden→…→erzeugt Klicks).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Crawl Runs, URL Explorer, Crawl-Diff, Segmentanalyse.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
95 % stabile Vollcrawls auf eigenen Sites (Gate Welle 2, §10).

## Future Extensions
Inkrementeller Recrawl nur geänderter Routen via Source-Map.

## Cross-Refs
§5/M2, §4.3, specs/issue-rules.md, specs/source-map.md
