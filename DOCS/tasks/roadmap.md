# Roadmap — Phase 2: Produktreife & Härtung

> Stand: 2026-06-25 · **Aktive, konsolidierte Planungsquelle.**
> Wahrheitsebene für Produkt/Scope bleibt `../docs/PRODUCT_MASTER_SPEC.md`.
> Diese Datei ersetzt den früheren `next-session-handoff.md` (→ archiviert) und fasst dessen
> noch offene Sprint-A/B/C-Punkte **gegen den realen Code-Stand validiert** zusammen.
> Paralleler Umsetzungsplan: **[`parallel-execution-plan.md`](./parallel-execution-plan.md)**.

---

## 0. Status-Snapshot (validiert 2026-06-25)

**Fundament steht und ist in Production verifiziert** (Branch-Arbeit dieser Session, PRs #31–#37):

| Bereich | Stand | Evidenz |
|---|---|---|
| Persistenz | ✅ **Neon Postgres** (Prod), embedded PGlite (lokal/Tests); Treiberwahl per `DATABASE_URL` | `apps/api/src/db/index.ts`, `infra/db/postgres/001..012` |
| Async Store-Schicht | ✅ sync→async portiert | tasks #1–#3 |
| Serverless Crawl-Worker | ✅ In-Process via Vercel-Cron `/api/cron/crawl` (täglich, `CRON_SECRET`) | `apps/web/vercel.json`, `apps/web/src/lib/crawl-cron.ts` |
| Job-Robustheit | ✅ Lease + Stale-Reclaim + Dead-Letter (attempts≤3) | `apps/api/src/stores/job-store.ts` |
| Connector-Sync planbar | ✅ `connector_sync`, tagesidempotent (3-fach) | `packages/domain-model/src/jobs.ts`, `apps/web/src/lib/connector-sync-cron.ts` |
| Technical-Audit-Filter | ✅ Status + Severity serverseitig + UI | PR #35 |
| Issue-Detail-Drawer | ✅ Issue-Drawer + Resolve/Dismiss/Reopen | PR #36 |
| Tests | ✅ **134 node + 215 web**, grün | `npm run check`, `@seo-tool/web test` |
| Produktion | ✅ live, Health ok | `queryland-mikadesign.vercel.app` |

**Damit geschlossen:** GAP-PERSIST-001 (Neon statt Turso), die „Sync-Store"-Strukturblockade, GAP-REPORT-003-Cron-Trigger (Mechanik vorhanden).

---

## 1. Production-Blocker (P0)

### WP-Z.1 — AuthZ Session-Gate  · **OFFEN (nur geplant)**
Validiert: kein Gate im Code, `AUTH_GATE_ENABLED` existiert nur in Docs, `cleanupExpiredSessions` ist **tote Funktion** (`apps/api/src/stores/auth-store.ts:89`).
- Session-Gate für alle Nicht-`/auth`/`/health`-Routen, per `AUTH_GATE_ENABLED` schaltbar.
- Audit-Log für abgelehnte Zugriffe; `cleanupExpiredSessions` verdrahten (Cron).
- Gate: ohne Token → 401, mit Token → wie bisher; `npm run check` grün; Tests zuerst.

> **Reihenfolge-Hinweis:** Das Gate legt die *Session-Kontext-Seam* (Actor) in die API-Eingangsschicht. Es sollte **früh** landen, weil mehrere Folgepunkte (Issue-Actor/Historie) den echten Actor daraus konsumieren.

---

## 2. Sprint A — Worker/Crawler härten  · **TEILWEISE**

| # | Punkt | Status | Befund |
|---|---|---|---|
| A1 | Fixture-Smoke automatisiert | ✅ | `services/crawler/test/crawler.test.ts` (end-to-end) |
| A2 | Echte Test-Site als Smoke-Ziel + Kriterien | ❌ | nur Platzhalter-Prozedur in `worker-smoke.md` |
| A3 | Retry/Timeout/Failure-Modes (Network/Sitemap/Robots) | 🟡 | Crawl- + Job-Ebene vorhanden; **kein Exponential-Backoff** |
| A4 | Robots/Sitemap-Details | 🟡 | Sitemap-Index ✅; **Bug `robots.ts:35`** (UA-Gruppen werden überschrieben statt akkumuliert); kein UA-Header |
| A5 | Betriebsmodus/Logs/Run-Job-Korrelation | 🟡 | Modi + JSON-Logs ✅; Serverless-Drain loggt **pro Zyklus nichts**, keine Korrelations-ID |

---

## 3. Sprint B — Connector-Verträge & echte Provider  · **TEILWEISE (credential-gated)**

| # | Punkt | Status | Befund |
|---|---|---|---|
| B1 | `connector_sync` planbar + idempotent | ✅ | erledigt (PR #34) |
| B2 | Provider-Contract (Auth-Status, Quota, Freshness, Sync-Evidenz) dokumentieren | ❌ | offen |
| B3 | GSC/PSI/Lighthouse als echte API/Store-Integration | ❌ | alles Stubs in `apps/api/src/connectors/index.ts`; **Lighthouse nicht registriert** |
| B4 | Failure-Modes (fehlende Creds, Quota, degradiert) sichtbar | ❌ | offen |

> Blockiert auf echte Credentials (DEC-002). Contract + Failure-Mode-Gerüst sind **jetzt** baubar; echtes `fetch()` ersetzen, sobald Creds da sind.

---

## 4. Sprint C — Technical-Audit-UI operativ  · **TEILWEISE**

| # | Punkt | Status | Befund |
|---|---|---|---|
| C1 | Pagination/Limits (Crawl-Runs, URL-Explorer, Issues) | 🟡 | API durchgängig paginiert; **UI ohne Controls**; **URL-Explorer-UI fehlt ganz** |
| C2 | Detail-Drawer mit Fetch/Indexability/Rule/Run-Kontext | 🟡 | Issue-Drawer ✅, aber **ohne** Fetch/Indexability/Run; **kein URL-Drawer** |
| C3 | Serverseitige Filter (Status/Severity/Rule/URL/Run) | 🟡 | Status+Severity (mit UI) ✅; Rule server-seitig ohne UI; URL/Run offen |
| C4 | Issue-Aktionen: Dismiss-Grund, Actor, Historie | 🟡 | Resolve/Dismiss/Reopen da, aber **resolve==dismiss funktional identisch**; Actor hart `"system"` (`crawl-store.ts:371`); keine Grund/Historie |
| C5 | Empty/Error/Loading-States | 🟡 | Empty ✅; Error grob; **kein Loading-State** |

---

## 5. UX/Backend-Tiefe (Roadmap-Reste)  →  [`../design/ux-ui-sprint.md`](../design/ux-ui-sprint.md)

- **UX-6b Crawl-Diff** (neues Backend) — offen.
- **UX-7 Content Workspace** (net-new, Scope-Entscheidung) — offen.

---

## 6. Hygiene & Querschnitt

- **GAP-SEC-001** — Next/PostCSS Dependency-Audit (moderate Findings) bewusst entscheiden.
- **Code-Hygiene:** `sqlite-store.ts`/`SQLiteStore`/`migrate-sqlite.ts` sind Legacy-Namen für den Postgres-Pfad → umbenennen reduziert Verwirrung (rein kosmetisch, breiter Rename → früh oder spät einplanen).
- **Doku-Hygiene:** abgeschlossen in dieser Session (URL-Drift, SQLite-Default-Sprache, Wave-Status, Handoff→Roadmap).

---

## 7. GAP-Register (aktualisiert; kanonische Historie: `_archive/roadmap-m0-m6.md`)

| ID | Bereich | Stand 2026-06-25 |
|---|---|---|
| GAP-PERSIST-001 | Persistenz | ✅ **geschlossen** (Neon + async) |
| GAP-REPORT-003 | Cron-Trigger | ✅ Mechanik vorhanden — `run-due`-Verdrahtung noch prüfen |
| GAP-AUTHZ-001 / WP-Z.1 | Security | ⛔ **offen** (P0-Blocker) |
| GAP-SEC-001 | Security | offen (Dependency-Audit-Entscheidung) |
| GAP-REPORT-002 | Delivery | offen (SMTP/Slack-Creds) |
| GAP-AUTH-001/-004 | Provider | offen (GSC-OAuth-Creds, DEC-002) |
| GAP-AI-001 | Provider | offen (LLM-Creds, DEC-002) |
| GAP-AI-002 | AEO | teil-entblockt (Worker da) |
| GAP-AI-003 | MCP-Write | offen (echtes Ticket/PR-Backend) |
| GAP-CRAWL-001 / GAP-WORKER-001 / GAP-LINK-001 | Crawler | teil-entblockt; Robustheit/Real-Site-Smoke offen (→ Sprint A) |
| GAP-AUTH-002/-003 | Authority | offen (Lizenz) |

---

## 8. Pflicht-Checks vor Übergabe

```bash
npm run check
npm --workspace @seo-tool/web run build
```
Bei Dependency-/Security-Arbeit zusätzlich: `npm audit --audit-level=moderate` (Next/PostCSS-Findings separat bewerten — `--force` kann Breaking sein).

## 9. Do-not-break

- Domain-Model-Typen (`packages/domain-model`) sind die zentrale Vertragsquelle (API/Store/Crawler/UI) — Änderungen zuerst dort + OpenAPI/Docs.
- Postgres-Schema nur per **neuer** versionierter Migration unter `infra/db/postgres`; keine stillen Spalten/Constraint-Änderungen ohne Test.
- `crawl_seed`-Kompatibilität nicht entfernen: Scheduling-Jobs tragen `crawlRunId`; ältere Jobs dürfen ohne starten (Worker vervollständigt).
- API-Pfade aus `../openapi/internal-api.yaml` nicht umbenennen, solange UI/Worker darauf bauen.
- Backend-Proxy-Adapter muss Query-Strings erhalten (sonst divergieren Browser- und interne API bei Pagination/Filtern).
- Client-Islands importieren nur reine `*-logic.ts`/`readiness.ts`, nie Loader/`next/headers`.
