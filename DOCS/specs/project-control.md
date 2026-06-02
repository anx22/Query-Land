# Module Spec: Project Control

> Verfeinert: Modul 1 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 1 geschärft.

## Purpose
Liefert den Kontext und Scope, gegen den alle anderen Module arbeiten. Reiner Kontext, keine Analyse.

## Scope
Projekte, Domains/Subdomains/Folder-Scopes, Märkte (Land/Sprache/Device/Suchmaschine), Zielseiten, Wettbewerber-Sets, Keyword-Sets, URL-Tags, Business-Wert pro URL/URL-Gruppe, Crawl-/Report-Frequenzen, Datenquellen-Verknüpfung, Zugriffsrechte.

## Non-Scope
Keine Empfehlungen, keine Crawls, keine Metrikberechnung.

## Data Sources
Manuelle Eingabe; verknüpfte Connectors (§4.2).

## Entities
`project · site · competitor · keyword_group · url`-Tags · `BusinessPriority` · `integration_account`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Business-Wert als Input für Prioritätsformel (§6.4, §2.11).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Project Overview, Projekt-Settings, Scope-/Wettbewerber-/Keyword-Set-Verwaltung.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Domain anlegen, GSC/GA4 verbinden, Crawl-Scope definieren (Gate Welle 1, §10).

## Future Extensions
Mehrmandanten-Rollenfeinheiten.

## Cross-Refs
§5/M1, §1, §2.11, §6.4
