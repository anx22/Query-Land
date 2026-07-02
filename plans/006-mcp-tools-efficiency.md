# Plan 006 — MCP `buildProjectSummary` + `resolveDiscoveredUrl` Effizienz

- **Kategorie:** Performance · **Aufwand:** M · **Risiko:** LOW · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

Zwei MCP-Tool-Helfer in `services/mcp/src/tools.ts` skalieren schlecht mit der Zahl der Sites/URLs.
Wie bei Plan 005 gilt: jeder Store-Aufruf ist gegen Neon ein Netzwerk-Roundtrip.

- **`buildProjectSummary` (Zeile 164–168):** sammelt die Top-Issues in einer **seriellen** `for`-Schleife
  über alle Sites und holt je Site bis zu `MAX_PAGE` (200) offene Issues, nur um projektweit die **Top 10**
  zurückzugeben. Bei 10 Sites × 500 Issues → 5000 Rows geladen + in-memory sortiert für 10 Zeilen.
  (Die Site-Health-Schleife Zeile 153–159 ist bereits `Promise.all` und ok.)
- **`resolveDiscoveredUrl` (Zeile 203–219):** bei fehlender `siteId` werden **alle** Sites durchlaufen,
  je Site `MAX_PAGE`-Rows paginiert und ein In-Memory-`find` gemacht → O(sites × pages) Queries statt
  einer indizierten Lookup-Query. Backt das MCP-Tool `get_url_dossier` (via `buildUrlDossier`, Zeile 222).

## Gewählter Ansatz

Rückgabe-Strukturen der Tools müssen **identisch** bleiben (Tests in `services/mcp/test/tools.test.ts`
prüfen sie).

1. **Top-Issues in `buildProjectSummary`:**
   - Minimal (ohne Store-Änderung): serielle Schleife auf `Promise.all` umstellen **und** `limit` je Site
     von `MAX_PAGE` auf `10` reduzieren (severity-sortiert lädt `listAuditIssuesPage` bereits passend),
     dann projektweit mergen, `severityRank`-sortieren, `slice(0, 10)`. Reiner MCP-Gewinn.
   - Ideal (empfohlen, wenn Aufwand vertretbar): neue Store-Methode
     `listTopOpenAuditIssuesByProject(projectId, limit)` mit **einer** Query über alle Sites:
     `... WHERE project_id = ? AND resolved_at IS NULL AND dismissed_at IS NULL ORDER BY <severity>, detected_at DESC LIMIT ?`.
     Die Severity-Sortierung muss der `severityRank`-Reihenfolge (critical→high→medium→low) entsprechen —
     in SQL via `CASE severity WHEN 'critical' THEN 0 ...` (Muster: die bestehende Sortierung in
     `listAuditIssuesPage`/`crawl-store.ts`). `buildProjectSummary` ruft dann nur noch **einmal** diese
     Methode statt einer Schleife.

2. **`resolveDiscoveredUrl`:** neue Store-Methode
   `findDiscoveredUrlInProject(projectId, url, siteId?)`, die in **einer** Query auflöst:
   ```sql
   SELECT ... FROM discovered_urls
   WHERE project_id = :pid AND (url = :url OR normalized_url = :url)
     [AND site_id = :sid]
   LIMIT 1
   ```
   und `{ site, discoveredUrl }` zurückgibt (Site aus `site_id` nachladen oder join). Den paginierten
   Multi-Site-Scan (Zeile 205–217) durch diesen Lookup ersetzen. `unknown_url`-Fehler beibehalten, wenn
   kein Treffer.

## Scope

- **In scope:** `services/mcp/src/tools.ts`; für den idealen Weg zusätzlich neue Methoden in
  `apps/api/src/stores/crawl-store.ts` (über das `BackendStore`-Interface exponiert).
- **Explizit out of scope:** die `get_project_summary`/`get_url_dossier`-Rückgabe-**Form**; andere
  MCP-Tools; die bereits parallele Site-Health-Schleife (Zeile 153–159) — die ist ok.

## Verifikation (Done-Kriterien)

1. `services/mcp/test/tools.test.ts` bleibt grün — `get_project_summary returns project, sites with
   health, counts and top issues` und `get_url_dossier resolves a URL ...` (Rückgabe unverändert).
2. Neuer Test: `resolveDiscoveredUrl`/`get_url_dossier` löst eine URL auf, die in der **letzten** von
   mehreren Sites liegt, **ohne** `siteId` — Treffer korrekt, Site korrekt zugeordnet.
3. Bei neuer Store-Methode: ein direkter Store-Test für `listTopOpenAuditIssuesByProject`
   (severity-Reihenfolge + Limit) und `findDiscoveredUrlInProject` (url vs. normalizedUrl, optional siteId).
4. `npm test` grün.

## Test-Plan

Die bestehenden Tool-Tests sind der Struktur-Regressionsschutz; die neuen Tests (Punkt 2/3) sichern die
neue Auflösungslogik ab. Kein Benchmark nötig — der Gewinn ist strukturell (1 Query statt O(sites×pages)).

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Wenn `listUrlExplorerRows` (der bisher genutzte Pfad) Rows mit Zusatz-Anreicherung
  (Joins auf Fetch/Index-Daten) liefert, die `buildUrlDossier` **nach** dem Match noch braucht, dann den
  schlanken Lookup nur zum **Finden** der ID nutzen und die Anreicherung über den bestehenden Pfad
  beibehalten — nicht Daten verlieren. Bei Unklarheit **STOP und melden**.
- Falls die neue Store-Methode zu viel Aufwand wird, ist die Minimal-Variante (Punkt 1, `Promise.all` +
  `limit: 10`) ein legitimer Teil-Fix — dann im Plan-Status vermerken, dass die ideale Query offen bleibt.
