# Module Spec: Project Control

> Verfeinert: Modul 1 (§5) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Welle-1 geschärft — Foundation-Scope ist implementierbar; spätere Analysefunktionen bleiben außerhalb.

## Purpose
Liefert den Kontext und Scope, gegen den alle anderen Module arbeiten. Reiner Kontext, keine Analyse.

## Scope
Projekte, Domains/Subdomains/Folder-Scopes, Märkte (Land/Sprache/Device/Suchmaschine), Zielseiten, Wettbewerber-Sets, Keyword-Sets, URL-Tags, Business-Wert pro URL/URL-Gruppe, Crawl-/Report-Frequenzen, Datenquellen-Verknüpfung, Zugriffsrechte.

## Non-Scope
Keine Empfehlungen, keine Crawls, keine Metrikberechnung.

## Data Sources
Manuelle Eingabe; verknüpfte Connectors (§4.2).

## Entities
`project · site · competitor · keyword_group · url_tag · business_priority · integration_account`

## Processing Pipeline
1. Projekt wird als `draft` angelegt und erhält `slug`, Default-Locale und initiale Märkte.
2. Mindestens eine `site` definiert Scope (`domain`, `subdomain`, `folder`), `base_url`, Crawl-Frequenz und Business-Wert 1–100.
3. Connectors werden nur referenziert; deren Auth-/Sync-Zustand liegt in `integration_account`.
4. Änderungen erzeugen Audit-Logs und invalidieren abhängige Jobs über idempotente Queue-Keys.

## Scoring / Classification
Business-Wert als Input für Prioritätsformel (§6.4, §2.11): 1–39 low, 40–74 medium, 75–100 high. Welle 1 persistiert den Wert lokal in SQLite; Opportunity-Scoring nutzt ihn ab Welle 4.

## API Endpoints
- `GET /projects` — Projekte mit Märkten und Status listen.
- `POST /projects` — Projekt im Status `draft` oder `active` anlegen.
- `GET /projects/{projectId}/sites` — Scopes und Business-Werte eines Projekts lesen.
- `POST /projects/{projectId}/sites` — Domain/Subdomain/Folder-Scope anlegen.
Details stehen in `/openapi/internal-api.yaml`.

## UI Screens
Project Overview, Projekt-Settings, Scope-/Wettbewerber-/Keyword-Set-Verwaltung. Welle 1 zeigt nur Overview-Karten und Scope-Basisdaten.

## States
`project.status = draft | active | archived`; `site.scope_type = domain | subdomain | folder`. Archivierte Projekte bleiben lesbar, starten aber keine Jobs.

## Error Handling
Ungültige URLs, doppelte Slugs und Business-Werte außerhalb 1–100 liefern 4xx-Fehler. Alle Schreibaktionen erzeugen Audit-Logs; Jobs bleiben idempotent (§4.1, §12.4).

## Observability
Project-/Site-Erstellung wird strukturiert geloggt. Queue-Invalidierungen erscheinen im Job-Monitoring → `specs/observability-sre.md`.

## Acceptance Tests
Domain anlegen, GSC/GA4 verbinden, Crawl-Scope definieren (Gate Welle 1, §10). Zusätzlich: Business-Wert validieren und doppelte Job-Erzeugung über Idempotency-Key in der embedded Queue verhindern.

## Future Extensions
Mehrmandanten-Rollenfeinheiten, Wettbewerber-Sets und Keyword-Gruppen werden in späteren Wellen fachlich aktiviert.

## Cross-Refs
§5/M1, §1, §2.11, §6.4
