# Plan 005 — `recordAuditIssues` N+1-Roundtrips reduzieren

- **Kategorie:** Performance / Korrektheit · **Aufwand:** S–M · **Risiko:** LOW · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

`apps/api/src/stores/crawl-store.ts` → `recordAuditIssues(projectId, siteId, issues, scope)` (ab
Zeile 331) läuft auf dem **Crawl-Schreibpfad** und macht O(N) redundante DB-Roundtrips. Entscheidend:
Der Wrapper `this.db.prepare(...).get()/.all()/.run()` ist eine dünne Better-SQLite3-artige Fassade über
**Postgres** — jedes `await` ist in Produktion (Neon) ein **Netzwerk-Roundtrip**. Bei einem Crawl, der
hunderte Audit-Issues schreibt, summiert sich das zu hunderten überflüssigen Roundtrips.

Konkrete Stellen:
- **Zeile 334–336:** `assertDiscoveredUrlScope(...)` in einer Schleife, ein Query je URL.
- **Zeile 339–341:** direkt danach werden **dieselben** Rows nochmal geholt
  (`SELECT url, normalized_url FROM discovered_urls WHERE id = ? AND project_id = ? AND site_id = ?`),
  also je URL ein **zweiter** Roundtrip für Daten, die die Scope-Query gerade berührt hat.
- **Zeile 380–396:** pro Issue ein separates `SELECT id FROM audit_issues WHERE id = ?` (Zeile 381),
  **nur** um `inserted` vs. `updated` zu zählen (Zeile 395: `existing ? updated += 1 : inserted += 1`) —
  obwohl das direkt folgende `INSERT ... ON CONFLICT(id) DO UPDATE` bereits korrekt upsertet.

## Gewählter Ansatz

Verhalten (Rückgabe `{ issues, inserted, updated, resolved }` **und** alle Scope-Validierungen) muss
**bit-identisch** bleiben — nur die Roundtrips zusammenlegen.

1. **Scope-Assert + Row-Fetch verschmelzen (Zeile 334–341):**
   Entweder `assertDiscoveredUrlScope` so erweitern, dass es die benötigten `url, normalized_url`
   **zurückgibt** (ein Query je URL statt zwei), **oder** alle `checkedDiscoveredUrlIds` in **einer**
   Query laden und Existenz-/Scope-Prüfung gegen das Ergebnis machen:
   ```sql
   SELECT id, url, normalized_url FROM discovered_urls
   WHERE id = ANY(:ids) AND project_id = :pid AND site_id = :sid
   ```
   Fehlt eine ID im Ergebnis → derselbe Scope-Fehler wie bisher werfen (Verhalten erhalten).

2. **Insert/Update-Zählung ohne Pre-Select (Zeile 380–396):**
   Vor der Upsert-Schleife **einmal** alle bereits existierenden IDs laden:
   ```sql
   SELECT id FROM audit_issues WHERE id = ANY(:submittedIssueIds)
   ```
   In ein `Set` legen; in der Schleife die Zählung in-memory bestimmen (`set.has(issue.id)` →
   `updated`, sonst `inserted`) und **nur** noch das `INSERT ... ON CONFLICT` je Issue ausführen.
   Das halbiert die Roundtrips der Upsert-Schleife (von 2N auf N + 1).
   - **Alternative** (Postgres `INSERT ... ON CONFLICT ... RETURNING (xmax = 0) AS inserted`) ist
     eleganter, aber `xmax` ist Postgres-spezifisch und könnte unter PGlite abweichen. **Nur** wählen,
     wenn ein PGlite-Test das Insert-vs-Update-Flag bestätigt; sonst die portable Vorab-Query nehmen.

3. **Array-Parameter-Bindung prüfen:** Ob der Wrapper `= ANY(:array)` / Array-Binding unterstützt, ist
   unklar. **Vorher** im Store greppen (`ANY(`, dynamische Platzhalter-Erzeugung) — falls kein
   Array-Binding: die passende Zahl `?`-Platzhalter dynamisch erzeugen (`id IN (?, ?, ...)`), Muster
   ggf. schon vorhanden. Bei sehr großen Issue-Mengen ggf. chunken (z. B. 500er-Batches).

## Scope

- **In scope:** `apps/api/src/stores/crawl-store.ts` — `recordAuditIssues` und ggf.
  `assertDiscoveredUrlScope` (Rückgabewert erweitern).
- **Explizit out of scope:** die Stale-Resolve-Logik (Zeile 364–378) **inhaltlich** unverändert lassen
  (nur konsistent auf die neue Row-Quelle umstellen, falls sie dieselben Rows nutzt); die
  `issue_scope_mismatch`-Würfe (Zeile 344–356) sind sicherheitsrelevant und dürfen **nicht** entfallen.

## Verifikation (Done-Kriterien)

1. Bestehende Tests bleiben grün — insbesondere:
   - `services/crawler/test/crawler.test.ts` → „persists crawl artifacts end-to-end" (schreibt
     Audit-Issues über den echten Pfad).
   - `apps/api/test/app.test.ts` → Audit-Issue-Fälle.
2. Neuer Test in `apps/api/test/`: `recordAuditIssues` zweimal aufrufen — erst mit N neuen Issues
   (erwartet `inserted = N, updated = 0`), dann mit einem Mix aus bestehenden + neuen (exakte
   `inserted`/`updated`-Zahlen prüfen) und einem weggefallenen Issue in-scope (erwartet `resolved >= 1`).
3. `npm test` grün.

## Test-Plan

Der neue Zähl-Test (Punkt 2) ist der Regressionsschutz für die riskanteste Änderung (Wegfall des
Pre-Selects). Kein Perf-Benchmark nötig — die Korrektheit der Zähler + grüne End-to-End-Tests genügen;
der Gewinn (weniger Roundtrips) ergibt sich strukturell.

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Wenn beim Lesen unklar ist, ob die Stale-Resolve-Logik (Zeile 364–378) dieselben
  gecheckten Rows braucht wie der neue Batch-Load, diese Logik **unverändert** lassen und nur die
  eindeutig redundanten Doppel-Fetches (Punkt 1) und den Pre-Select (Punkt 2) zusammenlegen.
- Falls ein PGlite-Test zeigt, dass `= ANY(...)` unter PGlite anders bindet als unter Neon → auf die
  `IN (?, ?, …)`-Variante ausweichen und melden.
- Dieselbe N+1-Signatur (`prepare().get()` in Schleife) existiert an weiteren Stellen im Store —
  dieser Plan behandelt nur `recordAuditIssues`; weitere Hotspots sind separate Tasks.
