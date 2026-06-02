# Module Spec: AI Visibility

> Verfeinert: Modul 7 (§5, §8) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 7 (Architektur ab Welle 1) geschärft.

## Purpose
Pflicht, nicht Add-on: Sichtbarkeit in AI-Antworten messen (§A.4). Architektonisch ab W1 vorbereitet.

## Scope
Prompt-Tracking, Citation-Tracking, Mention-Tracking, AI-Referral-Erfassung (AI-Traffic aus Analytics), AEO/GEO-Content-Checks, Sampling, Auditability.

## Non-Scope
Keine Primärmessung durch LLM (§2.8); AI-Metriken eigene Confidence, nicht mit Klasse A mischen.

## Data Sources
LLM-Stichproben (E), Analytics AI-Referrals (A/B).

## Entities
`ai_prompt · ai_mention · ai_citation · ai_referral`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
AI Visibility Share, AI Referral Impact (§8, W7-KPIs).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
AI-Visibility-Übersicht, Prompt/Citation-Tracker.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Agent beantwortet echte SEO-Fragen über eigene Daten (Gate Welle 7, §10).

## Future Extensions
AEO/GEO-Optimierungs-Opportunities.

## Cross-Refs
§5/M7, §8, §A.4, §2.8
