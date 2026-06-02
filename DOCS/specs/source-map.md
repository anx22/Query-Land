# Module Spec: Source Map

> Verfeinert: §4.3 (Differenzierer) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Gerüst — wird vor/während Welle 1 (Gerüst) / Welle 4 (Anchoring) geschärft.

## Purpose
Bildet eigene URLs auf ihren Quellcode ab — verwandelt 'Symptom auf N URLs' in 'eine Ursache an einer Datei' (§1.3, §2.4).

## Scope
url→template/component→repo_pfad-Zuordnung aus Routing-Config/Build-Manifest/Heuristik; Deploy-Marker (zeitlich); Pre-Merge-Gate als CI-Hook (geänderte Templates/Routes crawlen, gegen Baseline diffen).

## Non-Scope
Kein automatisches Mergen; Schreibaktionen reviewpflichtig (§4.4, §12.4).

## Data Sources
Repo (voller Zugriff), Routing-Konfiguration, Build-Manifest, CI-Events.

## Entities
`source_repo · template · url_template_map · deploy_marker · pr_check`

## Processing Pipeline
_TODO bei Implementierung: Job-States, Reihenfolge, Idempotenz (§12.4)._

## Scoring / Classification
Mapping-Konfidenz (exakt vs. heuristisch).

## API Endpoints
_TODO: maschinenlesbar in `/openapi/internal-api.yaml`; Agent konsumiert denselben Kern (§2.9, §4.4)._

## UI Screens
URL-Dossier zeigt Source-Anker; PR-Check-Status.

## States
_TODO: Zustandsmodell der Kernobjekte._

## Error Handling
_Fehler sichtbar, Jobs idempotent (§4.1, §12.4)._

## Observability
_Logging/Tracing/Job-Monitoring → `specs/observability-sre.md`._

## Acceptance Tests
Top-URLs einer Property auf Templates gemappt; Pre-Merge-Gate löst bei Regression failing check aus.

## Future Extensions
Automatischer Fix-PR-Vorschlag durch Agent (§4.4).

## Cross-Refs
§4.3, §1.3, §2.4, §6.2 (source_anchor), specs/crawl-engine.md
