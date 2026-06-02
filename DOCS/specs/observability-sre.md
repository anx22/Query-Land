# Module Spec: Observability & SRE

> Verfeinert: §4.1 (Foundation) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Welle-1 geschärft — Health, Job-Monitoring und strukturierte Fehler sind Foundation-Pflicht.

## Purpose
Fehler sichtbar machen, Jobs überwachen (§4.1, §12.4).

## Scope
Logging, Tracing, Error-Tracking, Job-Monitoring, Feature-Flags.

## Non-Scope
Keine SEO-Logik. Welle 1 baut noch keine externen APM-/Sentry-Integrationen ein.

## Data Sources
Alle Services/Worker, API-Requests, Job-Queue, Connector-Läufe, Source-Map-Refreshes.

## Entities
`job_queue · audit_log · feature_flag · health_snapshot · sqlite_backend` (API-Response, nicht dauerhaft persistiert)

## Processing Pipeline
1. Jeder Job besitzt `status`, `attempts`, `idempotency_key`, `scheduled_at`, `started_at`, `finished_at` und `last_error`.
2. API und Worker loggen strukturierte Events mit Service, Version, Projekt, Job-ID und Korrelation. API-Fehler enthalten eine `requestId`; JSON-Logs enthalten dieselbe ID.
3. `/health` meldet Service-Status, SQLite-Backend, Auth-Tabellen und Foundation-Checks.
4. Feature-Flags liegen in Postgres und dürfen riskante Funktionen wie JS-Rendering oder spätere Agent-Schreibaktionen steuern.

## Scoring / Classification
—

## API Endpoints
- `GET /health` — Service- und Foundation-Check.
- `GET /jobs` — Job-Monitoring.
- `POST /jobs` — idempotente Foundation-Jobs planen.
Details stehen in `/openapi/internal-api.yaml`.

## UI Screens
Job-/Fehler-Monitoring. Welle 1 zeigt Foundation-Karte; spätere UI ergänzt Tabellen und Fehlerdetails.

## States
`job.status = queued | running | succeeded | failed | cancelled`; Health-Status `ok | degraded`; SQLite-Check `ok | warn | fail`.

## Error Handling
Fehler werden nicht verschluckt: Job-Fehler bleiben in `last_error`, Health kann `degraded` melden, API-Fehler liefern strukturierte JSON-Antworten.

## Observability
Diese Spec definiert die Querlogik: Logging, Health und Job-Monitoring sind für Project Control, Integrations und Source Map verbindlich.

## Acceptance Tests
Jobs idempotent, Fehler sichtbar. Welle 1 testet `/health`, SQLite-Check, Auth-Session und idempotente `/jobs`-Erzeugung.

## Future Extensions
SLO-Dashboards, externe Tracing-/Error-Provider, Alerting-Regeln und Retention-Policies.

## Cross-Refs
§4.1, §12.4
