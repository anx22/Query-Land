# Module Spec: Security & Privacy

> Verfeinert: §4.1 (Foundation) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 1 geschärft.

## Purpose
Sicheres Betriebsfundament für alle Module.

## Scope
Auth (SSO-fähig), Rollen/Rechte, Audit-Logs, Datenschutz, Secret-Handling.

## Non-Scope
Keine SEO-Logik.

## Data Sources
Foundation.

## Entities
User/Role/AuditLog.

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
—

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
Auth-/Rollen-Settings.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Rollenbasierter Zugriff, Audit-Log aktiv.

## Future Extensions
Feingranulare Mandantenrechte.

## Cross-Refs
§4.1, §12.4
