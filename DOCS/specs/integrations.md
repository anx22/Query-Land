# Module Spec: Integrations & Connectors

> Verfeinert: §4.2 · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 1 geschärft.

## Purpose
Einheitliche, modulare Datenaufnahme ohne Vendor-Lock-in (§2.6).

## Scope
Connector-Interface (source_type, auth_config, fetch, normalize, validate, quota_status, freshness); OAuth/API-Verbindungen; tägliche Jobs; Rohdaten-Speicherung getrennt von Normalisierung; Confidence-Tagging (§2.7); Rate-Limit-/Quota-Handling; Job-Historie; Fehlerprotokoll.

## Non-Scope
Keine Analyse der Daten (das tun die Module).

## Data Sources
Primär A/B: GSC, URL Inspection, PSI, Lighthouse, GA4/Matomo, Serverlogs, Sitemap, robots.txt, eigener Crawler, CMS. Optional C/D: SERP-, Backlink-, Keyword-Provider.

## Entities
`integration_account · DataSource · ImportJob · RawEvent · NormalizedMetric · ApiQuota · DataFreshness`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Source-Confidence-Klasse A–E pro Quelle (§2.7).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Connector-Übersicht, Verbindungsstatus, Quota-/Freshness-Anzeige.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Mindestens GSC + GA4 verbindbar; Rohdaten und normalisierte Daten getrennt persistiert.

## Future Extensions
Weitere Provider als Plug-ins.

## Cross-Refs
§4.2, §2.6, §2.7, §3.2
