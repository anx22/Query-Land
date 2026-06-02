# Module Spec: Integrations & Connectors

> Verfeinert: §4.2 · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Welle-1 geschärft — Connector-Vertrag, Raw/Normalized-Trennung und Queue-Schnitt sind festgelegt.

## Purpose
Einheitliche, modulare Datenaufnahme ohne Vendor-Lock-in (§2.6).

## Scope
Connector-Interface (source_type, auth_config, fetch, normalize, validate, quota_status, freshness); OAuth/API-Verbindungen; tägliche Jobs; Rohdaten-Speicherung getrennt von Normalisierung; Confidence-Tagging (§2.7); Rate-Limit-/Quota-Handling; Job-Historie; Fehlerprotokoll.

## Non-Scope
Keine Analyse der Daten (das tun die Module). Welle 1 verbindet noch keine produktiven OAuth-Flows, sondern legt Vertrag, Statusmodell und persistente Trennung in SQLite an; derselbe Contract bleibt Postgres-kompatibel.

## Data Sources
Primär A/B: GSC, URL Inspection, PSI, Lighthouse, GA4/Matomo, Serverlogs, Sitemap, robots.txt, eigener Crawler, CMS. Optional C/D: SERP-, Backlink-, Keyword-Provider.

## Entities
`integration_account · import_job/job_queue · raw_event · normalized_metric · api_quota · data_freshness` (lokal in SQLite, später Postgres-kompatibel)

## Processing Pipeline
1. `integration_account` wird mit Provider, Auth-Konfigurationsplatzhalter, Status und Confidence-Klasse angelegt.
2. Ein idempotenter `connector_sync`-Job wird über `job_queue.idempotency_key` geplant.
3. Connector speichert unveränderte Antwort in `raw_events` inklusive `source_confidence`.
4. Normalisierung schreibt nur validierte Metriken in `normalized_metrics`; E-Klasse-LLM-Daten dürfen nie Evidenz werden.
5. Quota-/Freshness-Felder werden nach jedem Lauf aktualisiert; Fehler bleiben am Job sichtbar.

## Scoring / Classification
Source-Confidence-Klasse A–E pro Quelle (§2.7). Welle 1 codiert Provider-Defaults: A eigene Daten, B Google/eigene API, C beobachtete SERP, D Drittanbieter-Schätzung, E LLM-Interpretation.

## API Endpoints
- `GET /integrations` — Connector-Status, Quota und Freshness listen.
- `POST /integrations` — Connector für Projekt anlegen; Confidence wird aus Provider abgeleitet.
- `POST /jobs` mit `type=connector_sync` — Sync idempotent planen.
Details stehen in `/openapi/internal-api.yaml`.

## UI Screens
Connector-Übersicht, Verbindungsstatus, Quota-/Freshness-Anzeige. Welle 1 zeigt vorbereitete GSC-/GA4-Karten und Pending-Status.

## States
`integration.status = disconnected | pending | connected | degraded | error`; `job.status = queued | running | succeeded | failed | cancelled`.

## Error Handling
Quota-Überschreitung setzt `degraded`; Auth-Fehler setzen `error`. Jeder Fehler enthält Provider, Projekt, Job-ID und letzte Fehlermeldung. Wiederholungen nutzen denselben Idempotency-Key.

## Observability
Connector-Läufe loggen Start, Ende, Dauer, Datensätze, Quota und Fehler. Job-Monitoring → `specs/observability-sre.md`.

## Acceptance Tests
Mindestens GSC + GA4 verbindbar; Rohdaten und normalisierte Daten getrennt in der embedded DB persistiert. Welle 1 prüft Provider→Confidence-Mapping und idempotente Sync-Job-Erzeugung.

## Future Extensions
Weitere Provider als Plug-ins; produktive OAuth-Flows und Token-Rotation nach Security-Spec.

## Cross-Refs
§4.2, §2.6, §2.7, §3.2
