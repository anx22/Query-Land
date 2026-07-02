# Plan 010 — „Empty≠Error"-Muster ausrollen

- **Kategorie:** Direction / UX-Konsistenz · **Aufwand:** M · **Risiko:** LOW · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

Nur **Technical Audit**, **Dashboard/Overview** und **Content-Opportunities** unterscheiden heute ehrlich
zwischen den drei Leerzuständen „noch nicht berechnet" / „verbunden, aber leer" / „Anbieter nicht
verbunden". **Backlinks, Keywords, Reports und AI-Visibility** zeigen teils rohe Nullwerte oder
verstreute Inline-Notizen, sodass Nutzer nicht erkennen, ob wirklich nichts gefunden wurde oder die
erste Analyse/Verbindung nur noch fehlt. Roadmap-Item `DOCS/ROADMAP.md:38` („Empty≠Error-Muster auf die
übrigen Modul-Loader ausrollen").

## Vorhandenes Muster (wiederverwenden, nicht neu bauen)

- **`ModulesPending`** (`apps/web/src/components/modules-pending.tsx`): zentrierte First-Run-Karte mit
  Icon, Titel, Text, CTA (`ctaHref`/`ctaLabel`), plus `ctaDisabled` + `disabledReason`. Referenz-Nutzung:
  Dashboard (`components/dashboard.tsx:186`), Content-Opportunities
  (`app/content-opportunities/page.tsx:107`), Technical Audit (`app/technical-audit/page.tsx:409`).
- **Readiness-Helfer** (`apps/web/src/lib/readiness.ts`): `computeReadiness`, `actionLock`,
  `PREREQUISITE_META`, `firstUnmet` — liefern die „welches Prerequisite fehlt"-Logik + lokalisierte Texte.
- **Pure-Funktion-Muster für Caveats:** `deriveCrawlDataQuality`
  (`apps/web/src/features/technical-audit/crawl-data-quality.ts` + `.test.ts`) — gibt `null` (Daten
  solide) oder `{ level, message }` (thin/partial) zurück. **Testbar, ohne JSX.**

## Gewählter Ansatz — pro Modul den Leer-/First-Run-Zustand vereinheitlichen

Für jedes Modul das „ready"-Signal **aus den bereits geladenen Daten** ableiten (keine neuen API-Felder)
und, wo Logik entsteht, in eine testbare Pure-Funktion (Muster `crawl-data-quality.ts`) auslagern statt
in JSX:

- **Backlinks** (`apps/web/src/app/backlinks/page.tsx:82` ff.): die vorhandene Inline-Notice durch
  `ModulesPending` ersetzen; „verbunden, aber noch leer" (keine `snapshots`/`authority` trotz
  `data.connected`) klar von „Backlink-Anbieter folgt/nicht verbunden" trennen.
- **Keywords** (`apps/web/src/app/keywords-rank/page.tsx:177` ff.): den passiven Hinweis „erscheint nach
  der ersten Ranking-Messung" zu einem expliziten Caveat machen (Pure-Funktion: „Keywords getrackt, aber
  noch keine Ranking-Messung"). Signal: `totalKeywords > 0` aber `latestVisibility == null` / keine
  Rank-Snapshots.
- **Reports** (`apps/web/src/app/reports/page.tsx:128` ff.): die drei separaten Einzel-Leerkarten auf
  einen einheitlichen First-Run („Noch kein Report / Zeitplan / Alert erstellt") mit `ModulesPending`
  ausrichten. Signal: `reports.length === 0 && schedules.length === 0 && alertRules.length === 0`.
- **AI-Visibility** (`apps/web/src/app/ai-visibility/page.tsx:91` ff.): verstreute Inline-Notices zu
  einem First-Run bündeln; „KI-Anbieter nicht verbunden" (`!aiConfigured`, optional) klar von
  „verbunden, aber kein Messergebnis" (`visibility == null`/`prompts === 0`) trennen.

Konsistenz: dieselbe Terminologie/Tonalität wie Technical Audit/Dashboard verwenden; wo sinnvoll
`PREREQUISITE_META`/`actionLock` für CTA-Sperren nutzen (z. B. „zuerst Website anlegen/Analyse starten").

## Scope

- **In scope:** die vier Modul-Seiten (`backlinks`, `keywords-rank`, `reports`, `ai-visibility`), je
  optional eine kleine `*-data-quality.ts`-Pure-Funktion unter dem jeweiligen `features/<modul>/` + Test.
- **Explizit out of scope:** API-/Datenmodell-Änderungen; die bereits konformen Module (Technical Audit,
  Dashboard, Content-Opportunities); ein Redesign von `ModulesPending` selbst.

## Verifikation (Done-Kriterien)

1. Je Modul mit neuer Pure-Funktion: ein Vitest-Test (Muster `crawl-data-quality.test.ts`) für die drei
   Zustände (nicht berechnet / verbunden-aber-leer / Anbieter fehlt).
2. `npm --workspace @seo-tool/web run test` grün; `check:css-classes` grün (neue className↔CSS
   konsistent — der bestehende Guard läuft in `npm run check`).
3. Manuell gegen `next dev` je Modul mit **leerem** Projekt: honest First-Run/Caveat statt roher Null
   oder irreführendem „0".
4. `npm run typecheck` grün.

## Test-Plan

Die Pure-Funktion je Modul ist der testbare Kern (drei Zustände abdecken). Die JSX-Einbindung wird
manuell im Browser verifiziert (leeres Projekt anlegen, Modul öffnen). Kein E2E nötig.

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Liefert ein Modul kein Datensignal, um „noch nicht berechnet" sauber von „verbunden,
  aber leer" zu trennen, den Zustand konservativ als „noch nicht berechnet" labeln und den fehlenden
  Signal-Bedarf **melden** — **keine** API-Erweiterung im Rahmen dieses Plans (das wäre ein separater
  Backend-Task).
- Neue Module künftig direkt gegen dieses Muster bauen (ein First-Run-Zustand via `ModulesPending` +
  optionaler Caveat-Pure-Funktion), damit die Konsistenz erhalten bleibt.
