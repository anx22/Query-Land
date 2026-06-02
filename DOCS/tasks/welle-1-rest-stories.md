# Welle-1 Reststories — Gate schließen

## W1-REST-001 — Projekt und Domain persistent anzeigen

- **Status:** ready
- **Spec refs:** `project-control.md`, OpenAPI `/projects`, `/projects/{projectId}/sites`
- **Acceptance:** User creates a project and site; dashboard reads it from SQLite after reload.
- **Test gate:** API create/list tests + UI smoke.

## W1-REST-002 — GSC/GA4 Stub verbinden und Sync-Job planen

- **Status:** ready
- **Spec refs:** `integrations.md`, OpenAPI `/integrations`, `/jobs`
- **Acceptance:** User creates GSC/GA4 connector placeholders and sees queued `connector_sync` jobs.
- **Test gate:** API tests for provider confidence + idempotency.

## W1-REST-003 — Crawl Seed Job starten und Status verfolgen

- **Status:** ready
- **Spec refs:** `crawl-engine.md`, `observability-sre.md`
- **Acceptance:** User starts a `crawl_seed` job for a site and sees queued/running/succeeded states.
- **Test gate:** Queue claim/complete tests.

## W1-REST-004 — Source-Map-Refresh starten und Mapping anzeigen

- **Status:** ready
- **Spec refs:** `source-map.md`, OpenAPI `/source-map`, `/jobs`
- **Acceptance:** User triggers `source_map_refresh` and sees URL pattern → repo path mapping.
- **Test gate:** Store/source-map API tests.
