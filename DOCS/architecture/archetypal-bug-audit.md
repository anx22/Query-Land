# Archetypal-Bug Audit & Engineering Guardrails

> Stand: 2026-06-26 · Ausgelöst durch den A2-Smoke-Bug (Runner nahm ein entferntes Demo-Seed an → 404).
> Ziel: die **wellenbau-typischen Fehlerklassen** dieser App benennen, den Ist-Stand auditieren und
> Guardrails festhalten, damit neue Module nicht denselben Fehler erneut einbauen.
> Methodik: 5 statische Audits (A–E) über `apps/api`, `apps/web`, `services/*`, `packages/*`.

## TL;DR — Reifegrad
Der **Produktions-Code ist überwiegend gut gehärtet** (Stores/Routes/MCP guarden leere/fehlende Rows und werfen echte 404; Web-Loader fangen Fehler ab). Die systemischen Risiken liegen in **zwei** Mustern:
1. **B — Fehler werden zu „leer" verschluckt** (pervasiv in Web-Loadern) → *False-Positives*: ein fehlgeschlagener Fetch ist von „keine Daten" ununterscheidbar und wird als gesund/leer gerendert. **Das ist die wichtigste offene Klasse.**
2. **C/D — Transport-Annahmen** an wenigen Stellen (`payload?.data as T` → `undefined.id`; un-awaited Provider-`fetch()`), die der A2/B3-Wurzel entsprechen.

---

## Die Archetypen

### A — Implizite Fixture/Seed/State-Abhängigkeit (der A2-Wurzelfehler)
Code/Tests nehmen vorab existierende Daten / feste IDs an, die in frischem/Prod-Zustand fehlen.
- **Befund:** Production-Code ist sauber (Stores/Loader/MCP guarden konsequent; `smoke.ts` legt Projekt/Site selbst an). Rest sind **Test-Kopplungen** an die `proj-${slug}`-Ableitung (`seedDemoFoundation` → `proj-demo`/`site-demo`) — der A2-Bug nur in Tests verlagert.
- **Med:** Demo-Fixtures (`demoProject`/`site-main`/…) liegen noch im **Prod-Paket** `packages/shared-config` und lecken via `apps/api/src/index.ts` `getFoundationState()` in die Runtime-Oberfläche.
- **Guardrail:** Keine festen Entity-IDs außerhalb von Tests; Tests provisionieren ihre Fixtures selbst und nutzen zurückgegebene IDs; Demo-Fixtures gehören in ein Test-/`__fixtures__`-Paket, nicht in `shared-config`.

### B — Silent Error Swallowing / False-Positives  ⚠️ wichtigste Klasse
Ein Fehler wird still zu leer/„ok" → das UI zeigt etwas Falsches.
- **Befund (pervasiv):** nahezu jeder Web-Loader nutzt `.catch(() => [])`/`null` ohne den Fehler zu signalisieren — `audit-api.ts`, `overview-api.ts`, `backlinks-api.ts`, `keywords-api.ts`, `reports-api.ts`, `content-api.ts`. Ein Netzwerk-/API-Fehler ist damit **ununterscheidbar von „keine Daten"** und wird als leerer/gesunder Zustand gerendert.
- **Guardrail:** Loader müssen **Empty ≠ Error** trennen: pro Sektion einen Fehlerzustand mitführen (z. B. `{ data, failed: true }`) und im UI ein sichtbares Fehler-Notice statt eines leeren Erfolgs rendern. Stub/Demo-Daten **immer** Confidence-/Demo-getaggt (ConfidenceBadge), nie als echt darstellen.

### C — Async-Seams halb verdrahtet (der B3-Wurzelfehler)
Eine Funktion wurde async, aber ein Aufrufer behandelt das Promise als Wert.
- **Befund:** Production ist sauber bis auf **einen** echten Seam: `BacklinkProvider.fetch` ist sync-typisiert (`BacklinkRow[]`) und wird in `backlink-store.ts` **un-awaited** konsumiert — abweichend von den bereits async-migrierten `SerpProvider`/`SearchAnalyticsProvider`. Latent, bis ein echter Backlink-Adapter (Netzwerk) kommt → dann operiert `rows.map/.length` auf einem Promise.
- **Guardrail:** Provider-Verträge einheitlich `T | Promise<T>` + Aufrufer `await`. Nie Truthiness auf einem evtl. un-awaiteten Promise (`if (live)`); erst `await`, dann prüfen.

### D — Ungeschützter Response/Store-Zugriff (das `undefined.id`-Symptom)
- **High:** Crawler-Transport `post<T>` (`services/crawler/src/worker.ts`, `apps/web/src/lib/crawl-worker-client.ts`) gibt `payload?.data as T` ohne Presence-Check zurück → `crawl-cycle.ts` derefenziert `.id`/`.status` → genau die A2-Fehlermeldung, falls eine 2xx-Antwort kein `data` trägt.
- **High:** `apps/api/src/server.ts` `JSON.parse(rawBody)` ohne try/catch → 500 statt 400 bei kaputtem JSON (die Web-Proxy-Route macht es bereits richtig).
- **Med:** `proposal-store.ts` `ALLOWED_TRANSITIONS[current]` mit `current` aus der DB ungeprüft → `.includes` wirft, wenn ein Status außerhalb des Enums in der DB steht.
- **Low:** viele `JSON.parse(String(row.col))` in Row-Mappers/Stores ohne try/catch → werfen bei NULL/korrupter Spalte (sicheres Muster existiert in `source-map-store.ts`).
- **Guardrail:** API-Antworten erst auf Status prüfen, dann `data`; Store-Reads mit Existenz-Check + typisiertem `RequestError`; `JSON.parse` über einen `safeJson*`-Helfer.

### E — Daten-Contract: Idempotenz/Pagination/Migrationen
- **Befund: sauber.** Migrations-Manifest in Sync (14/14), `connector_sync` 3-fach idempotent, Pagination geclamped, `ON DELETE CASCADE` konsistent. Keine Findings.

---

## Fix-Status (dieser Durchgang)
- ✅ D: Crawler-`post`/`createCrawlRun`-Deref guarded (typisierter Fehler statt `undefined.id`).
- ✅ D: `server.ts` JSON.parse → 400 `invalid_json`.
- ✅ D: `proposal-store` Transition gegen unbekannten DB-Status gehärtet.
- ✅ C: `BacklinkProvider.fetch` Vertrag auf `T | Promise<T>` + `await` (Seam vor-entschärft).
- ⏭️ **B (systemisch, größte Klasse):** Loader-Error-Surfacing (Empty≠Error) — Muster hier definiert; Umsetzung modulweise als eigener Track (Start: Technical-Audit).
- ⏭️ A (med): Demo-Fixtures aus `shared-config` in ein Test-Fixtures-Paket ziehen.
