# Roadmap — Phase 2: Produktreife & UX-Reconciliation

> Stand: 2026-06-07 · Aktive Roadmap. Wahrheitsebene bleibt `docs/PRODUCT_MASTER_SPEC.md`; UX-Soll ist `docs/PRODUCT_MASTER_SPEC.md` §A.5 (UX-Navigation & Screens).
>
> 📦 **Vorgänger (abgeschlossen):** Phase 1 (M0–M6) → gestrafft in `_archive/roadmap-m0-m6.md`; Phase-1-Abschluss + Codex-Prompts in `_archive/phase1-summary.md`.

## Ausgangslage

Phase 1 lieferte alle sieben Funktions-Milestones (M0–M6, alle Gates ✅). Ein UI-Review am 2026-06-07 gegen die UX-Navigation/Screens (`docs/PRODUCT_MASTER_SPEC.md` §A.5) zeigte: Bausteine, Navigation und Interaktions-Prinzip stimmen, aber die **inhaltliche** Deckung ist uneben — die Overview ist auf M0-Stand (inkl. Demo-Fixtures + Selbstwiderspruch), Texte/Metadaten sind veraltet, ein Schlüssel-Screen fehlt, mehrere Screens erfüllen ihre Feature-Liste nur teilweise.

**Phasenziel:** Das fertige Produkt im UI **sichtbar, markengerecht und konsistent** machen, dann härten — und die strukturell geblockten GAPs schließen, sobald Credentials bzw. der async Worker-Pfad verfügbar sind.

## Leitprinzipien
- Konsistenz zur UX-Spec (`docs/PRODUCT_MASTER_SPEC.md` §A.5): Screen an Spec anpassen **oder** Spec bewusst nachziehen (keine stille Drift).
- Nur echte Daten im UI; keine Demo-Fixtures in produktiven Screens.
- Jede Aufgabe mit klarem Done-Gate; `npm run check` + `build:web` bleiben grün.

---

## 1. UX/UI-Sprint  →  **[`../design/ux-ui-sprint.md`](../design/ux-ui-sprint.md)**

Der **gesamte** UX/UI-Sprint — Aufgabenliste **plus** die Specs (Voice & Microcopy · UI-Kit/Charts/Tokens · Component-Placement) — liegt **konsolidiert in diesem einen Dokument**. Hier nur die Kurzfassung:

- **Block 1 (P0, kein Backend):** UX-9 Erklär-Infrastruktur + Chart-Lib (Recharts/visx) · UX-3 Voice/Microcopy-Reframe · UX-2 Nav-Metadaten · UX-1 Overview-Neubau · UX-8 UX-Spec nachziehen (jetzt `docs/PRODUCT_MASTER_SPEC.md` §A.5). Reihenfolge **UX-9 → 3 → 2 → 1 → 8**.
- **Block 2 (P1):** UX-4 URL-Dossier-360° · UX-5 Opportunity-Board (PriorityMatrix/Kanban/Evidence-Drawer) · UX-6a Issue-Groups + Funnel + Treemap · **UX-6b Crawl-Diff (neues Backend)**.
- **Block 3:** UX-7 Content Workspace (net-new, Scope-Entscheidung).

Marke „Query-Land", Berater-Ton mit dosierter Land-Metapher (Serious-Zonen rein sachlich), DE + Anglizismen, Konfidenz als Klartext+Farbe — alles verbindlich im Sprint-Dokument.

## 2. AuthZ — WP-Z.1 (Querschnitt, vor produktivem Einsatz)

Session-Gate für alle nicht-`/auth`- und nicht-`/health`-Routen, per `AUTH_GATE_ENABLED` schaltbar; Audit-Log für abgelehnte Zugriffe; `cleanupExpiredSessions` aktivieren; Tests zuerst.
**Gate:** bei aktivem Gate ohne Token → 401, mit Token → wie bisher; `npm run check` grün.

## 3. Hintergrund-Backlog — strukturell geblockt (nicht Sprint-planbar)

Brauchen **Credentials** und/oder den **async Crawler/Worker-Pfad** (Codex) bzw. eine Sync→Async-Refaktorierung der Store-Schicht. IDs + Details im GAP-Register von `_archive/roadmap-m0-m6.md`.

- **Echte Provider** (DEC-002): GSC-OAuth (GAP-AUTH-001/-004), LLM (GAP-AI-001), SERP/PSI — Stub-Seam steht, nur `fetch()` ersetzen.
- **Echte Delivery & Cron** (GAP-REPORT-002/-003): SMTP/Slack + `run-due`-Trigger im Worker.
- **Persistenz** (GAP-PERSIST-001): Turso/Neon + async DB-Client.
- **Crawler/Worker** (GAP-WORKER-001, GAP-LINK-001, GAP-CRAWL-001, GAP-AI-002): Robustheit, echte-Site-Smokes, Linkgraph-/Content-Befüllung — Codex-Koordination.
- **Dependency-Audit** (GAP-SEC-001): Next/PostCSS moderate Findings gezielt entscheiden.

## Reihenfolge-Begründung
Erst die billigen, hochsichtbaren UX-Korrekturen (Block 1) — sie bringen das gebaute Produkt korrekt zur Anzeige. Dann Screen-Tiefe (Block 2). Danach Scope-Klärung (Block 3) und **AuthZ** als Tor zum produktiven Einsatz. Die geblockten GAPs laufen später, sobald Credentials/Worker bereitstehen.
