# Phase 1 Abschluss-Zusammenfassung (M0–M6)

> ✅ **Phase 1 vollständig abgeschlossen (2026-06-06).** Aktuelle Roadmap: [`roadmap.md`](../roadmap.md).

## Getroffene Weichenstellungen

| Frage | Entscheidung | Wirkung |
|---|---|---|
| Plattform-Typ (DEC-001) | **Content + SaaS** | Crawl-Fixtures (W2) und Opportunity-Klassen (W4) auf Content/SaaS zugeschnitten |
| MCP/Agent-Timing (DEC-004) | **Nach Welle 4** | MCP-Tools erst bauen, wenn Opportunities existieren |
| AuthZ-Tiefe | **Single-Tenant minimal — ans Ende verschoben** | Kein Login-Gate während Entwicklung; minimales Session-Gate vor Produktivbetrieb (WP-Z.1 unten) |

Offen (später): DEC-002 (Provider), DEC-003 (Märkte DACH), DEC-005 (Open-Source), GAP-PERSIST-001 (Turso/Neon).

## Milestone-Abschluss

| Milestone | Welle | Status |
|---|---|---|
| M0 Gates & Härtung | 1–2 | ✅ WP-0.2–0.7 alle erledigt; AuthZ bewusst herausgelöst |
| M1 Opportunity-Rückgrat | 4 (vorgezogen) | ✅ Source Map, Opportunity+Evidence Schema/API, erster Generator, Board v0 + URL Dossier v0 |
| M2 Keyword Core | 3 | ✅ Keyword-Bibliothek, Clustering, Intent, Rank-Tracking, SERP-Snapshots, Visibility-Index |
| M3 Opportunity Engine + MCP | 4 | ✅ Search-Performance-Intelligence, 5 Opportunity-Klassen, Source-Map Pre-Merge-Gate, MCP read-only |
| M4 Authority | 5 | ✅ GSC-Links-Stub, Ref-Domain-Modell, New/Lost, Authority-Summary, UI + MCP |
| M5 Reporting | 6 | ✅ Report-Typen, CSV/HTML/PDF-Export, Alerts, UI + MCP |
| M6 AI + MCP-Vollausbau | 7 | ✅ AiPrompt/Snapshot/Score, AeoCheck/Assessment, Proposals, MCP-Schreibtools (review-gated) |

**Offene GAPs nach Phase 1:**
- GAP-AI-001: echter LLM-Provider statt Stub
- GAP-AI-002/003: Crawler-Content für AEO, externes Ticket-/PR-Backend
- GAP-REPORT-002/003: echte Email/Slack-Delivery, worker-getriebener Cron
- GAP-AUTH-001: echter GSC-OAuth-Provider
- GAP-PERSIST-001: Persistenz-Dienst (Turso/Neon) — Skizze in `serverless-persistence-turso.md`

Strukturelle Blocker für GAPs: (a) keine Credentials in der Umgebung, (b) synchrone `node:sqlite` Store-Schicht.

---

## WP-Z.1 — AuthZ-minimal (noch offen — vor produktivem Einsatz)

```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§4.1, §12.4) und specs/security-privacy.md als Detailebene.
Scope: NUR minimale Autorisierung für den internen Single-Tenant-Betrieb. KEINE volle per-Projekt-RBAC.
Ist-Zustand: Auth (scrypt, Sessions, Bearer-Token) existiert in apps/api/src/stores/auth-store.ts; Business-Endpunkte
in apps/api/src/routes haben bewusst KEIN Session-Gate (login-freie Entwicklung). Jetzt aktivieren.
Aufgabe:
- Führe eine Gate-Funktion in apps/api/src/app.ts ein, die für alle nicht-/auth- und nicht-/health-Routen einen
  gültigen Bearer-Token verlangt (über getUserBySessionToken). Ungültig/fehlend -> 401 im bestehenden Fehlerformat.
- Optional per ENV (z.B. AUTH_GATE_ENABLED) schaltbar, damit lokales login-freies Testen weiter möglich bleibt.
- Schreibe Audit-Log-Einträge (audit-log.ts) für abgelehnte Zugriffe.
- Rufe cleanupExpiredSessions() periodisch oder beim Login auf (derzeit tote Funktion).
Tests zuerst: Zugriff ohne/mit ungültigem/mit gültigem Token auf je einen Lese- und Schreib-Endpunkt.
Akzeptanz: npm run check grün; bei aktivem Gate geschützte Endpunkte ohne Token -> 401, mit Token -> wie bisher.
Lege alle Annahmen offen. Dokumentiere, was bewusst NICHT abgedeckt ist (per-Projekt-RBAC = noch späteres Paket).
```
