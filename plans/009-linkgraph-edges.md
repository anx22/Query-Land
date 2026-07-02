# Plan 009 — Interner Linkgraph: Edges befüllen (GAP-LINK-001)

- **Kategorie:** Direction / Feature-Vervollständigung · **Aufwand:** L · **Risiko:** MED · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

Schema, Store, Route und Typen für den internen Linkgraph existieren — aber der **Crawler schreibt nie
Edges**, daher bleiben Orphan-Detection und link-basierte Content-Opportunities dauerhaft leer.
Roadmap-Gap `GAP-LINK-001`.

Vorhandene, **fertige** Bausteine (nicht ändern):
- Tabelle `infra/db/postgres/003_internal_link_edges.sql`:
  Spalten `id, project_id, site_id, from_url, to_url, anchor, rel, discovered_at`,
  UNIQUE `(site_id, from_url, to_url)`, Indizes auf `(site_id, to_url)` und `(site_id, from_url)`.
- Store `apps/api/src/stores/link-graph-store.ts:76` — `recordInternalLinks(projectId, siteId, edges)`
  mit `InternalLinkEdgeInput { fromUrl, toUrl, anchor?, rel? }`, Upsert + Dedup auf dem Unique-Key.
  Plus `listInternalLinks(...)` und `listOrphanUrls(...)`.
- Route `apps/api/src/routes/internal-links.ts` — `POST /projects/{pid}/sites/{sid}/internal-links`
  mit Body `{ edges: [...] }` (nimmt die Edges bereits an), plus `GET` zum Auslesen.

**Die Lücke:**
- `recordInternalLinks` fehlt im `CrawlWorkerApiClient`-Interface (`services/crawler/src/types.ts:84–105`).
- Keine Implementierung in `HttpCrawlWorkerApiClient` (`services/crawler/src/worker.ts:13–100`).
- Kein Aufruf in `services/crawler/src/crawl-cycle.ts` (weder im non-resumable Pfad Zeile ~19–251 noch
  im resumable Pfad Zeile ~260–432).
- `ParsedLink` (`services/crawler/src/html-parse.ts:16–21`) trägt nur `url` + `nofollow` — **kein**
  Anker-Text, **kein** `rel`.

## Gewählter Ansatz (Spike + Umsetzung, L)

1. **Anker + `rel` erfassen (empfohlen, da das Schema es vorsieht):**
   `ParsedLink` um `anchor?: string` und `rel?: string` erweitern und in `html-parse.ts` beim
   Anchor-Parsing mitnehmen: sichtbaren Text-Content (getrimmt, ggf. gekürzt) als `anchor`, das rohe
   `rel`-Attribut als `rel`. **Minimal-Variante**, falls verschachteltes Markup den Anker-Text nicht
   verlustfrei liefert: Edges mit `anchor = null, rel = null` schreiben (beide Spalten nullable) und den
   Anker als Follow-up nachrüsten — melden, wenn du diesen Weg nimmst.

2. **Client-Methode ergänzen** — exakt nach dem Muster von `recordDiscoveredUrls`/`recordAuditIssues`:
   - Interface: `recordInternalLinks(projectId, siteId, edges): Promise<{inserted:number; updated:number}>`
     in `CrawlWorkerApiClient` (`types.ts`).
   - Impl in `HttpCrawlWorkerApiClient` (`worker.ts`):
     `return this.post('/projects/${projectId}/sites/${siteId}/internal-links', { edges });`

3. **Verdrahtung im Crawl (beide Pfade):**
   Je gefetchter Seite die **same-site**-Links zu Edges mappen und **gebündelt** (nicht pro Link)
   senden:
   - Non-resumable: die Links liegen bereits als `{ url, from }` vor (Ableitung um Zeile 179–183, wo
     `isInCrawlScope` filtert). Zu `{ fromUrl: from, toUrl: url, anchor, rel }` mappen.
   - Resumable: `parsed.links` sind um Zeile 369 verfügbar; analog mappen.
   - `isInCrawlScope(link, effectiveBase, scopeType)` als Same-Site-Filter **wiederverwenden** (keine
     zweite Scope-Logik). Externe Links werden nicht als interne Edges geschrieben.
   - **Hot-Path-Performance:** Edges **pro Seite** in einem `recordInternalLinks`-Call bündeln; die
     bestehende Concurrency-/Backoff-Struktur (`mapWithConcurrency`) nicht durchbrechen. Fehler beim
     Edge-Recording dürfen den Crawl einer Seite nicht abbrechen (per-URL-Error-Boundary beibehalten).

4. **Backfill (optional, separat):** bestehende Crawl-Runs neu parsen → Edges nachtragen. **Nicht** Teil
   dieses Kern-Plans; als Follow-up-Task notieren.

## Scope

- **In scope:** `services/crawler/src/{html-parse.ts, types.ts, worker.ts, crawl-cycle.ts}`.
- **Explizit out of scope:** `link-graph-store.ts`, `routes/internal-links.ts`, das Schema/die Migration
  (alle fertig); die UI-Anbindung (Orphan-/Link-Anzeige) — separater Direction-Task, sobald Daten fließen.

## Verifikation (Done-Kriterien)

1. Integrationstest in `services/crawler/test/crawler.test.ts` (Muster „persists crawl artifacts
   end-to-end"): eine Fixture-Site mit bekannten internen Links crawlen, danach über den Store
   (`listInternalLinks`) bzw. `GET /projects/{pid}/sites/{sid}/internal-links` prüfen:
   - erwartete `from_url → to_url`-Kanten vorhanden (in- und out-Richtung),
   - Dedup: gleiche Kante zweimal entdeckt → ein Edge (Upsert),
   - `anchor`/`rel` gesetzt (bzw. bei Minimal-Variante bewusst `null`),
   - externe Links erzeugen **keine** Edge.
2. `apps/api/test/link-graph.test.ts` bleibt grün (Store-Contract unverändert).
3. `npm test` grün; `npm run typecheck` grün (neues Interface-Feld überall konsistent).

## Test-Plan

Der End-to-End-Crawl-Test (Punkt 1) ist der Kern. Ergänzend ein kleiner `html-parse`-Unit-Test, dass
`anchor`/`rel` korrekt aus einem `<a rel="nofollow ugc" href=...>Text</a>` extrahiert werden (bzw. bei
Minimal-Variante: dass `nofollow` weiterhin korrekt erkannt wird).

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Liefert `html-parse` bei verschachteltem Markup den Anker-Text nicht sauber, die
  Minimal-Variante (`anchor = null`) wählen und melden — **nicht** den Parser groß umbauen (eigener Task).
- **Escape-Hatch:** Wenn das Bündeln der Edges die Crawl-Latenz je Seite messbar verschlechtert oder mit
  der Backoff-/Concurrency-Logik kollidiert, den Edge-Call ans Ende der Seitenverarbeitung verschieben
  (fire-and-collect, dann ein Batch je Seite) und melden.
- Sobald Daten fließen: Follow-up-Tasks sind (a) Backfill bestehender Runs, (b) UI für Orphan-/
  Inlink-Analyse, (c) link-basierte Opportunities — jeweils separat planen.
