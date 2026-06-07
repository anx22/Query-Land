# [ARCHIV] Roadmap Phase 1 — M0–M6 (Foundation → AI-Layer)

> ⚠️ **Veraltet / abgeschlossen.** Diese Roadmap deckte Phase 1 (M0–M6) ab und ist **abgeschlossen**.
> Aktuelle Roadmap: **`../roadmap.md`** (Phase 2). Detaillierter Ausführungsverlauf + Codex-Prompts: **`../codex-execution-plan.md`**.
> Gestraffte Fassung — nur Ergebnisse, Gates und das GAP-Register (für spätere Suchen). Stand bei Archivierung: 2026-06-07.

## Ergebnis Phase 1

Sieben Milestones (Wellen 1–7) als vertikale Schnitte geliefert; `npm run check` + Web-Build grün, 126 Tests, 12 Migrationen, MCP mit 14 Tools (read + review-gated write).

| Milestone | Welle | Gate | Status |
|---|---|---|---|
| **M0** Gates & Härtung | 1–2 | W1/W2-Gates bewiesen, Linkgraph, Web Vitals, Connector-Contract, Modularisierung+Tests | ✅ |
| **M1** Opportunity-Rückgrat | 4 (vorgezogen) | Indexierbarkeits-Fix open→implemented→validated mit Vorher/Nachher | ✅ |
| **M2** Keyword Core | 3 | Keyword-Bibliothek+Intent, Rank/SERP-Diffs (Stub), Visibility-Index, Verläufe | ✅ |
| **M3** Opportunity Engine + MCP | 4 | Search-Performance-Intelligence, 5 Opportunity-Klassen + Prioritätsscore, Source-Map Pre-Merge-Gate, MCP read-only | ✅ |
| **M4** Authority | 5 | GSC-Link-Import (Stub), Ref-Domains, New/Lost, Authority-Intelligence | ✅ |
| **M5** Reporting | 6 | Report-Typen, Export CSV/HTML/**PDF**, Delivery-Stub, Schedules/`run-due`, Alerts | ✅ |
| **M6** AI + MCP-Vollausbau | 7 | AI-Visibility (Klasse E), AEO (→ 6. Opportunity-Klasse, Klasse A), review-gated MCP-Schreibtools | ✅ |

## Getroffene Weichenstellungen

- **DEC-001** Plattform: Content + SaaS · **DEC-003** Märkte: DACH/DE-Default · **DEC-004** MCP-Timing: nach Welle 4.
- **DEC-002** (Provider): bewusst deterministische Stubs für SERP/GSC/PSI/LLM; Provider-Seam austauschbar.
- **AuthZ** bewusst ans Ende verschoben (login-freies Entwickeln) → offen als **WP-Z.1**.

## GAP-Register (Stand Archivierung)

| ID | Bereich | Kurz | Status |
|---|---|---|---|
| GAP-REPORT-001 | Reporting/Export | PDF-Export | ✅ CLOSED (dependency-freier `reportToPdf`) |
| GAP-MCP-SDK | MCP/Transport | offizielles `@modelcontextprotocol/sdk` | ✅ CLOSED |
| GAP-AUTHZ-001 / WP-Z.1 | Security | Business-Endpunkte ohne Projekt-/Rollen-Gate | offen (P0 Phase 2) |
| GAP-PERSIST-001 | Persistenz | Prod nutzt ephemeres `/tmp`-SQLite; braucht Turso/Neon + async-Client | offen (P2/P3) |
| GAP-REPORT-002 | Delivery | echte Email/Slack-Zustellung | offen — Credentials + async Worker |
| GAP-REPORT-003 | Scheduling | Cron-Trigger für `run-due` | offen — Codex/Worker |
| GAP-AUTH-001 / -004 | Authority | echter GSC-OAuth-Provider + Historie | offen — Credentials (DEC-002) |
| GAP-AUTH-002 / -003 | Authority | Drittanbieter-Backlinks (Klasse D) + Competitor-Gap | offen — Lizenz |
| GAP-AI-001 | AI | echter LLM-Provider statt Stub | offen — Credentials (DEC-002) |
| GAP-AI-002 | AEO | crawler-gelieferter Content statt manuell | offen — Worker |
| GAP-AI-003 | MCP-Schreibtools | echtes Ticketing/PR-Backend hinter `acceptProposal` | offen |
| GAP-CRAWL-001 / GAP-LINK-001 / GAP-WORKER-001 | Crawler | robustes Parsing, Linkgraph-Befüllung, Worker-Betrieb/echte-Site-Smokes | offen — Codex/Crawler |

### Strukturelle Sperre (warum vieles „offen" bleibt)
Die echten netzgebundenen Provider/Delivery/Persistenz sind durch zwei Faktoren blockiert: (a) **keine Credentials** in der Umgebung, (b) **synchrone Store-Schicht** (`node:sqlite DatabaseSync`) — blockendes `fetch` geht nicht in Store-Methoden. Diese GAPs gehören in den **async Crawler/Worker-Pfad (Codex)** bzw. erfordern eine Sync→Async-Refaktorierung. Der Provider-Seam (DEC-002) ist vorbereitet.

> Volldetails (Sprint-Beschreibungen, Prozent-Einschätzungen, Wave-Slice-Tabellen) siehe Git-Historie dieser Datei vor 2026-06-07 bzw. `../codex-execution-plan.md`.
