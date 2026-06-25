> ⚠️ **Archiviert (2026-06-25).** Superseded durch [`../roadmap.md`](../roadmap.md) + [`../parallel-execution-plan.md`](../parallel-execution-plan.md). Historischer Stand — nicht mehr pflegen.

# Welle-1 Reststories — Gate schließen

> Status nach Bestandsaufnahme 2026-06-03: Backend-Fundamente sind weitgehend vorhanden, aber das Welle-1-Gate ist erst geschlossen, wenn die UI echte SQLite/API-Daten nutzt. Details: `next-session-handoff.md`.

## W1-REST-001 — Projekt und Domain persistent anzeigen

- **Status:** in_progress
- **Spec refs:** `project-control.md`, OpenAPI `/projects`, `/projects/{projectId}/sites`
- **Backend-Stand:** API/SQLite create/list vorhanden und getestet.
- **Offene Lücke:** Dashboard und Project UI lesen noch Demo-Fixtures statt echte API-Daten.
- **Acceptance:** User creates a project and site; dashboard reads it from SQLite after reload.
- **Test gate:** API create/list tests + UI smoke.

## W1-REST-002 — GSC/GA4 Stub verbinden und Sync-Job planen

- **Status:** in_progress
- **Spec refs:** `integrations.md`, OpenAPI `/integrations`, `/jobs`
- **Backend-Stand:** Integration-Placeholder, Provider Confidence und idempotente Jobs vorhanden.
- **Offene Lücke:** Connector-UI und sichtbare Job-Planung fehlen.
- **Acceptance:** User creates GSC/GA4 connector placeholders and sees queued `connector_sync` jobs.
- **Test gate:** API tests for provider confidence + idempotency + UI smoke.

## W1-REST-003 — Crawl Seed Job starten und Status verfolgen

- **Status:** in_progress
- **Spec refs:** `crawl-engine.md`, `observability-sre.md`
- **Backend-Stand:** Job Queue, Crawl Runs und Crawl-Artefakt-Contracts vorhanden.
- **Offene Lücke:** UI-Button und Worker, der `crawl_seed` wirklich ausführt, fehlen.
- **Acceptance:** User starts a `crawl_seed` job for a site and sees queued/running/succeeded states.
- **Test gate:** Queue claim/complete tests + Crawl-Run UI smoke.

## W1-REST-004 — Source-Map-Refresh starten und Mapping anzeigen

- **Status:** in_progress
- **Spec refs:** `source-map.md`, OpenAPI `/source-map`, `/jobs`
- **Backend-Stand:** Source-Map-Listing und Seed-Mapping vorhanden.
- **Offene Lücke:** Refresh-Job-Auslösung und echte UI-Anzeige fehlen.
- **Acceptance:** User triggers `source_map_refresh` and sees URL pattern → repo path mapping.
- **Test gate:** Store/source-map API tests + UI smoke.

## Welle-1 Gate-Entscheidung

- Backend allein reicht nicht für Gate-Schließung.
- Nächster Sprint-Fokus: `next-session-handoff.md` Sprint A — Foundation UI echt machen.
- Gate gilt als bestanden, wenn der Flow `Projekt anlegen → Site anlegen → Connector Stub → Job sichtbar → Reload hält Daten` ohne manuelle API-Aufrufe läuft.
