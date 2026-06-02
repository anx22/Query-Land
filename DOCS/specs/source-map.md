# Module Spec: Source Map

> Verfeinert: §4.3 (Differenzierer) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Welle-1 geschärft — Basismodell, SQLite-Persistenz und API stehen; Welle 4 ergänzt Opportunity-Anchoring.

## Purpose
Bildet eigene URLs auf ihren Quellcode ab — verwandelt 'Symptom auf N URLs' in 'eine Ursache an einer Datei' (§1.3, §2.4).

## Scope
url→template/component→repo_pfad-Zuordnung aus Routing-Config/Build-Manifest/Heuristik; Deploy-Marker (zeitlich); Pre-Merge-Gate als CI-Hook (geänderte Templates/Routes crawlen, gegen Baseline diffen).

## Non-Scope
Kein automatisches Mergen; Schreibaktionen reviewpflichtig (§4.4, §12.4). Welle 1 erzeugt noch keine Fix-PRs.

## Data Sources
Repo (voller Zugriff), Routing-Konfiguration, Build-Manifest, CI-Events.

## Entities
`source_repo · template · url_template_map · deploy_marker · pr_check`

## Processing Pipeline
1. `source_repo` registriert Repo-URL und Default-Branch pro Projekt.
2. `source_map_refresh` liest Routing-/Manifestdaten und erzeugt `template`-Datensätze mit `repo_path`.
3. URL-Muster werden über `url_template_map` auf Templates gemappt; jede Zuordnung trägt `confidence = exact | manifest | heuristic | unknown`.
4. Deploys schreiben `deploy_marker`; Crawl-Diffs können ab Welle 2 darauf referenzieren.
5. Pre-Merge-Gate bleibt zunächst Contract/CI-Hook-Schnitt, wird mit Crawl-Core praktisch validiert.

## Scoring / Classification
Mapping-Konfidenz: `exact` für deklarative Routen, `manifest` für Build-Manifeste, `heuristic` für Pattern-Matching, `unknown` für manuell zu prüfende Zuordnungen.

## API Endpoints
- `GET /source-map` — Source-Anker für Projekt/URL-Muster listen.
- `POST /jobs` mit `type=source_map_refresh` — Mapping-Refresh idempotent planen.
Details stehen in `/openapi/internal-api.yaml`.

## UI Screens
URL-Dossier zeigt Source-Anker; PR-Check-Status. Welle 1 zeigt Foundation-Karte mit erstem Demo-Mapping.

## States
`mapping.confidence = exact | manifest | heuristic | unknown`; `pr_check.status = queued | running | passed | failed | skipped` für spätere CI-Gates.

## Error Handling
Nicht auflösbare Templates werden mit `unknown` gespeichert statt verworfen. Repo-/Manifestfehler erzeugen sichtbare Job-Fehler und Audit-Log-Einträge.

## Observability
Refresh-Jobs loggen Anzahl Templates, Mappings, Unknowns und Laufzeit. Job-Monitoring → `specs/observability-sre.md`.

## Acceptance Tests
Top-URLs einer Property auf Templates gemappt; Pre-Merge-Gate löst bei Regression failing check aus. Welle 1 prüft vorhandene Demo-URL→Repo-Pfad-Zuordnung aus der embedded DB.

## Future Extensions
Automatischer Fix-PR-Vorschlag durch Agent (§4.4) und Opportunity-`source_anchor` ab Welle 4.

## Cross-Refs
§4.3, §1.3, §2.4, §6.2 (source_anchor), specs/crawl-engine.md
