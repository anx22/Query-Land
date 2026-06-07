# Roadmap — Phase 2: Produktreife & UX-Reconciliation

> Stand: 2026-06-07 · Aktive Roadmap. Wahrheitsebene bleibt `docs/PRODUCT_MASTER_SPEC.md`; UX-Soll ist `docs/UX_FLOWS.md`.
>
> 📦 **Vorgänger (abgeschlossen):** Phase 1 (M0–M6) → gestrafft in `_archive/roadmap-m0-m6.md`; detaillierter Ausführungsverlauf + Codex-Prompts in `codex-execution-plan.md`. Das alte Tracking-Dokument `roadmap-tracking.md` ist nur noch ein Verweis-Stub.

## Ausgangslage

Phase 1 lieferte alle sieben Funktions-Milestones (M0–M6, alle Gates ✅). Ein UI-Review am 2026-06-07 gegen `UX_FLOWS.md` zeigte: Bausteine, Navigation und Interaktions-Prinzip stimmen, aber die **inhaltliche** Deckung ist uneben — vor allem ist die **Overview auf M0-Stand stehengeblieben (inkl. Demo-Fixtures + Selbstwiderspruch)**, Metadaten/Texte sind veraltet, ein Schlüssel-Screen fehlt, und mehrere Screens erfüllen ihre Feature-Liste nur teilweise.

**Phasenziel:** Das fertige Produkt im UI **sichtbar und konsistent** machen, dann stabilisieren/härten — und die strukturell geblockten GAPs schließen, sobald Credentials bzw. der async Worker-Pfad verfügbar sind.

## Leitprinzipien
- Konsistenz zu `UX_FLOWS.md`: entweder Screen an Spec anpassen **oder** Spec bewusst nachziehen (keine stille Drift).
- Nur echte Daten im UI; keine Demo-Fixtures in produktiven Screens.
- Jede Aufgabe mit klarem Done-Gate; `npm run check` + `build:web` bleiben grün.

---

## Sprint 1 — UX-Reconciliation P0 (billig, höchste Sichtbarkeit)

> Behebt die gravierendsten Soll/Ist-Lücken aus dem UI-Review. Klein, hoher Hebel.
> Alle Punkte am 2026-06-07 per Code-Verifikation bestätigt; Datenquellen unten sind real vorhandene Endpunkte.
> **Voice-Spec (aus Quiz-Audit 2026-06-07): [`../design/voice-and-microcopy.md`](../design/voice-and-microcopy.md)** — Marke „Query-Land" (Land-Metapher als Klammer, Substanz sachlich), Anrede neutral-imperativ/Sie, DE+Anglizismen, Begriffsmap (Opportunity→Chance, Source Anchor→Quell-Verknüpfung, Indexability→Indexierbarkeit), Konfidenz als Klartext+Farbe, Wortverbote.
> Empfohlene Reihenfolge: **UX-9 → UX-3 → UX-2 → UX-1 → UX-8**.

| ID | Aufgabe | Aufwand | Done-Gate |
|---|---|---|---|
| **UX-3** | **Voice & Microcopy (hochgestuft).** Durchgängiger Reframe von Entwickler-/Roadmap-Sprache zu SEO-Praktiker-Nutzen. Raus aus nutzersichtbarer Copy: `Welle/Wave`, `Slice`, `Stub`, `v0`, `§x.y`, `SQLite/API`, `Contracts`, `connector_sync`, `Foundation-State`, „Worker folgt", „noch Demo-Modul". Konkrete Stellen u. a.: `technical-audit/page.tsx:37`, `content-opportunities/page.tsx:23`, `backlinks/page.tsx:25`, `keywords-rank/page.tsx:21`, `settings/page.tsx:49`, `projects/page.tsx:18`, `dashboard.tsx:53-56,143`, **`app-shell.tsx:11-12` (hartkodiertes „Welle 1 · Foundation"-Badge + hartkodiertes Datum „UTC 2026-06-02")**. Hero-Texte = Nutzen statt Bauphase; interne Confidence-/Evidenz-Hinweise als dezente Badges/Tooltips statt §-Zitate. **Umsetzung strikt nach `../design/voice-and-microcopy.md`** (Begriffsmap, Claim „Sichtbarkeit, die sich belegen lässt", Land-Metapher nur in Hero/Empty/Erfolg). | S–M (Copy) | Keine Entwickler-/Wellen-/§-Sprache mehr in nutzersichtbarer Copy; Begriffe/Claim/Anrede gemäß Guide; Topbar ohne hartkodiertes Datum. |
| **UX-2** | **Navigations-Metadaten korrigieren** (`module-routes.ts`, `navigation.tsx`): gebaute Module (`content-opportunities`, `backlinks`, `reports`, `ai-visibility`) `status:"planned"` → `"active"`; `icon`-Feld real rendern (Material Symbols — Font-Verfügbarkeit prüfen) **oder** entfernen (aktuell tot, Initialen). Toten Code `planned-module-page.tsx` (`createPlannedModulePage`, nirgendwo aufgerufen) entfernen. | S | Nav-Metadaten == realer Stand; kein totes `icon`-Feld/keine Dead-Code-Datei. |
| **UX-1** | **Overview neu aufbauen** (`components/dashboard.tsx`, `lib/foundation-api.ts`, `page.tsx`): echte KPIs gemäß UX_FLOWS — Visibility (`GET /projects/{id}/visibility`), Health (`…/health-scores`), Top-5-Opportunities (`/opportunities?limit=5`, default priority-sortiert), Risiken (`…/audit-issues?status=open&severity=critical`), letzte Crawls (`…/crawl-runs`), letzte Reports (`/reports`). `demoOpportunities`/`seoMemory` entfernen; Selbstwiderspruch auflösen. **Gotcha:** aggregierte organische Klicks/Impressionen haben *keinen* Endpoint — entweder 1-Zeilen-Summe über `search-performance` (kleine Backend-Ergänzung) oder „n/a · GSC-Sync ausstehend"-Platzhalter. | M | Overview zeigt nur echte API-Daten + deckt UX_FLOWS-Liste; keine Demo-Fixtures importiert. |
| **UX-9** | **Erklär-Infrastruktur** (Voraussetzung für UX-1/3/4, aus dem Audit beschlossen): wiederverwendbare Tooltip-/Info-Icon-Komponente, `KonfidenzBadge` (Klartext+Farbe, A–E→Label gemäß Guide §5), „Warum das zählt"-Zeile als Baustein, **Glossar-Seite** (`/glossar`) mit Tooltip-Verlinkung. Erklär-Priorität: Konfidenz/Evidenz, Opportunity & Priorität, Indexierbarkeit & Crawl, Visibility & Rankings. | M | Komponenten + Glossar live und in mind. einem Screen verwendet. |
| **UX-8** | **`UX_FLOWS.md` nachziehen**: `URL Dossier` in die Nav-Zeile aufnehmen; „Content Workspace" als ausstehend markieren (siehe UX-7); neue Begriffe (Chance/Quell-Verknüpfung) + Marke „Query-Land" spiegeln. | S (Doku) | Spec == Intent; bewusste Abweichungen dokumentiert. |

**Sprint-Gate:** Marke/Voice (Query-Land), Navigation, Erklär-Hilfen und Texte spiegeln den realen Stand und den Voice-Guide; `npm run check` + `build:web` grün.

---

## Sprint 2 — Screen-Tiefe P1 (Feature-Listen vervollständigen)

| ID | Aufgabe | Aufwand | Backend nötig? |
|---|---|---|---|
| **UX-4** | **URL Dossier vervollständigen** (`features/url-dossier`, `url-dossier/page.tsx`): GSC-Leistung + Rankings/Queries (aus `…/search-performance`, nach `pageUrl` filtern), externe Links (aus `/projects/{id}/backlinks`, nach `targetUrl` filtern), Web-Vitals (site-skopiert, mit Hinweis). Content-Fit bewusst später (kein Endpoint). | M | Nein (optional `?pageUrl=`/`?targetUrl=`-Filter; sonst client-seitig). Content-Fit = später. |
| **UX-5** | **Opportunity Board ausbauen** (`content-opportunities/page.tsx`, `features/.../api.ts`): **Typ-Filter** (Endpoint akzeptiert `type` bereits → 0 Backend), Impact/Effort/URL-Gruppe client-seitig (Felder sind am Objekt); echte Evidence-/Validation-Drawer (Daten `evidence[]`/`validationMetric` werden bereits geliefert → `"use client"`-Drawer). | S (Typ-Filter) + M (Drawer) | Nein |
| **UX-6a** | **Issue Groups** (`technical-audit/page.tsx`): Issues nach `rule`/`severity` gruppieren statt flacher Tabelle. | S | Nein (rein client-seitig) |
| **UX-6b** | **Crawl-Diff** (zwei Runs vergleichen: neue/entfernte URLs, Statuswechsel). Kein Endpoint vorhanden. | L | **Ja** — neue Store-Methode `crawlDiff` + Route + UI |

**Sprint-Gate:** Overview, URL Dossier, Opportunity Board und Technical Audit erfüllen ihre UX_FLOWS-Feature-Liste (Crawl-Diff ggf. als eigener Schritt); `npm run check` + `build:web` grün.

---

## Sprint 3 — Scope-Entscheidung & AuthZ

| ID | Aufgabe | Done-Gate |
|---|---|---|
| **UX-7** | **Content Workspace** (fehlt komplett — **net-new, XL**: weder Backend noch Frontend existiert). Scope-Entscheidung treffen — bauen (Briefings, Refresh-Kandidaten, interne Linkvorschläge, Snippet-Vorschläge; neue Endpunkte + Screen `/content-workspace`) **oder** bewusst verschieben und in `UX_FLOWS.md` markieren. | Entscheidung dokumentiert (`decisions-backlog.md`); falls gebaut: Screen live + spec-konform. |
| **WP-Z.1** | **AuthZ-minimal** (Querschnitt, aus Phase 1 übernommen): Session-Gate für alle nicht-/auth-/nicht-/health-Routen, per `AUTH_GATE_ENABLED` schaltbar; Audit-Log für abgelehnte Zugriffe; `cleanupExpiredSessions` aktivieren. Tests zuerst. | Bei aktivem Gate: geschützte Endpunkte ohne Token → 401, mit Token → wie bisher; `npm run check` grün. |

---

## Hintergrund-Backlog — strukturell geblockt (nicht Sprint-planbar)

Diese Posten brauchen **Credentials** und/oder den **async Crawler/Worker-Pfad** (Codex) bzw. eine Sync→Async-Refaktorierung der Store-Schicht. Details + IDs im GAP-Register von `_archive/roadmap-m0-m6.md`.

- **Echte Provider** (DEC-002): GSC-OAuth (GAP-AUTH-001/-004), LLM (GAP-AI-001), SERP/PSI — Stub-Seam steht, nur `fetch()` ersetzen.
- **Echte Delivery & Cron** (GAP-REPORT-002/-003): SMTP/Slack + `run-due`-Trigger im Worker.
- **Persistenz** (GAP-PERSIST-001): Turso/Neon + async DB-Client.
- **Crawler/Worker** (GAP-WORKER-001, GAP-LINK-001, GAP-CRAWL-001, GAP-AI-002): Robustheit, echte-Site-Smokes, Linkgraph-/Content-Befüllung — Codex-Koordination.
- **Dependency-Audit** (GAP-SEC-001): Next/PostCSS moderate Findings gezielt entscheiden.

## Reihenfolge-Begründung
Erst die **billigen, hochsichtbaren** UX-Korrekturen (Sprint 1) — sie bringen das bereits gebaute Produkt korrekt zur Anzeige. Dann **Screen-Tiefe** (Sprint 2) entlang der UX_FLOWS-Feature-Listen. Danach **Scope-Klärung + AuthZ** (Sprint 3) als Tor zum produktiven Einsatz. Die strukturell geblockten GAPs laufen parallel/später, sobald Credentials oder Worker bereitstehen.
