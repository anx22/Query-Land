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

| ID | Aufgabe | Done-Gate |
|---|---|---|
| **UX-1** | **Overview neu aufbauen** (`components/dashboard.tsx`): echte KPIs gemäß UX_FLOWS Project-Overview — Visibility-Index (M2), Health-Score (M0), Top-Opportunities (M1/M3, echt statt `demoOpportunities`), letzte Crawls/Reports (M5), Risiken (offene kritische Issues/Alerts). `demoOpportunities`/`seoMemory`-Importe entfernen; Selbstwiderspruch (Hero-Text vs. Demo-Daten) auflösen. | Overview zeigt ausschließlich echte API-Daten und deckt die UX_FLOWS-Liste; keine Demo-Fixtures mehr importiert. |
| **UX-2** | **Navigations-Metadaten korrigieren** (`module-routes.ts`, `navigation.tsx`): gebaute Module (`content-opportunities`, `backlinks`, `reports`, `ai-visibility`) von `status:"planned"` → `"active"`; `icon`-Feld entweder in der Sidebar nutzen oder entfernen (aktuell tot, Initialen werden gerendert). | Nav-Metadaten == realer Stand; kein totes `icon`-Feld. |
| **UX-3** | **Veraltete Texte entschärfen**: u. a. Technical-Audit-Hero „Welle-2 UI-Slice … Worker folgt", Opportunity-Board „v0", Overview „noch Demo-Modul"/„Wave 1". | Keine Texte mehr, die den fertigen Stand untertreiben/falsch beschreiben. |
| **UX-8** | **`UX_FLOWS.md` nachziehen**, wo bewusst abgewichen: `URL Dossier` in die Nav-Zeile aufnehmen; Status von „Content Workspace" (siehe UX-7) markieren. | Spec == Intent; bewusste Abweichungen dokumentiert. |

**Sprint-Gate:** Overview + Navigation + Texte spiegeln den realen M0–M6-Stand; `npm run check` + `build:web` grün.

---

## Sprint 2 — Screen-Tiefe P1 (Feature-Listen vervollständigen)

| ID | Aufgabe | Done-Gate |
|---|---|---|
| **UX-4** | **URL Dossier vervollständigen** (`features/url-dossier`, `url-dossier/page.tsx`): GSC-Leistung (Klicks/Impressionen je URL), Rankings/Queries (aus Rank/Search-Performance), externe Links (Backlinks auf die URL), Performance/Web-Vitals je URL ergänzen; Content-Fit als bewusst-später markieren. | Dossier deckt ≥ 10/12 UX_FLOWS-Facetten; fehlende explizit als später ausgewiesen. |
| **UX-5** | **Opportunity Board ausbauen** (`content-opportunities/page.tsx`): Filter Typ / URL-Gruppe / Impact / Effort zusätzlich zu Status; echte Evidence- und Validation-Drawer (statt nur Inline-Text). | Filterset + Drawer gemäß UX_FLOWS Opportunity Board. |
| **UX-6** | **Technical Audit vervollständigen**: Issues gruppiert darstellen („Issue Groups" nach Rule/Severity statt flacher Tabelle) + **Crawl-Diff** (zwei Runs vergleichen). | 4/4 UX_FLOWS-Facetten (Crawl Runs, Issue Groups, URL Explorer, Crawl-Diff). |

**Sprint-Gate:** Die vier UX_FLOWS-Schlüssel-Screens (Overview, URL Dossier, Opportunity Board, Technical Audit) erfüllen ihre Spec-Feature-Liste; `npm run check` + `build:web` grün.

---

## Sprint 3 — Scope-Entscheidung & AuthZ

| ID | Aufgabe | Done-Gate |
|---|---|---|
| **UX-7** | **Content Workspace** (fehlt komplett): Scope-Entscheidung treffen — bauen (Briefings, Refresh-Kandidaten, interne Linkvorschläge, Snippet-Vorschläge) **oder** bewusst auf später verschieben und in `UX_FLOWS.md` markieren. Bei „bauen": eigener Screen `/content-workspace`. | Entscheidung dokumentiert (`decisions-backlog.md`); falls gebaut: Screen live + spec-konform. |
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
