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
| Code-Hygiene (Rename) | ✅ Legacy-SQLite-Namen → `store`/`Store` | PR #38 (T0) |
| AuthZ-Gate | ✅ implementiert, `AUTH_GATE_ENABLED` (default OFF) | PR #39 (T1) |
| URL-Explorer + Pagination + URL-Drawer | ✅ | PR #40 (T3) |
| Worker-Härtung (Robots/UA/Backoff/Korrelation) | ✅ | PR #41 (T2) |
| Connector-Contract + Lighthouse + Failure-Modes | ✅ (credential-gated) | PR #42 (T5) |
| Issue-Lifecycle (distinct Dismiss/Actor/Historie) | ✅ | PR #43 (T4) |
| Crawl-Diff (As-of-Lifecycle-Diff + Vergleichs-UI) | ✅ | PR #45/#46 (UX-6b) |
| Content Workspace (Refresh-Board, Brief-Editor, Linkvorschläge, MCP-Bridge) | ✅ | PR #49/#50 (UX-7) |
| Tests | ✅ **173 node + 306 web**, grün | `npm run check`, `@seo-tool/web test` |
| Produktion | ✅ live, Health ok | `queryland-mikadesign.vercel.app` |

**Damit geschlossen:** GAP-PERSIST-001 (Neon statt Turso), die „Sync-Store"-Strukturblockade, GAP-REPORT-003-Cron-Trigger (Mechanik vorhanden), und mit Welle 0+1 der Großteil von WP-Z.1 (AuthZ) sowie Sprint A/B/C (siehe unten).

---

## 1. Production-Blocker (P0)

### WP-Z.1 — AuthZ Session-Gate  · **IMPLEMENTIERT (default OFF)** (PR #39)
- ✅ Session-Gate für alle Nicht-`/auth`/`/health`-Routen, per `AUTH_GATE_ENABLED` schaltbar (default OFF → bestehende Deployments unberührt).
- ✅ Strukturiertes Log für abgelehnte Zugriffe; `cleanupExpiredSessions` verdrahtet (war tote Funktion).
- ✅ Actor-Seam: Gate legt `{userId, role}` in den Request-Context, durchgereicht bis in die Routes (von T4 konsumiert).
- **Verbleibend zum Scharfschalten:** Web-Layer leitet das User-Session-Token bei serverseitigen API-Calls weiter → dann `AUTH_GATE_ENABLED=true` in Production. Erst danach ist der Actor echt (statt `"system"`).

---

## 2. Sprint A — Worker/Crawler härten  · **WEITGEHEND ERLEDIGT** (PR #41)

| # | Punkt | Status | Befund |
|---|---|---|---|
| A1 | Fixture-Smoke automatisiert | ✅ | `services/crawler/test/crawler.test.ts` (end-to-end) |
| A2 | Echte Test-Site als Smoke-Ziel + Kriterien | 🟡 | `worker-smoke.md` aktualisiert mit Ziel + Kriterien + Befehlen; **manueller** Real-Site-Run noch ausstehend (kein CI-Test, bewusst deterministisch) |
| A3 | Retry/Timeout/Failure-Modes (Network/Sitemap/Robots) | ✅ | + Capped **Exponential-Backoff** (injizierbares Timing) |
| A4 | Robots/Sitemap-Details | ✅ | Sitemap-Index ✅; Robots-UA-Gruppen-Bug gefixt (akkumulieren + spezifischste Gruppe); echter `User-Agent`-Header |
| A5 | Betriebsmodus/Logs/Run-Job-Korrelation | ✅ | Per-Zyklus-Log (`crawl_drain_cycle`) mit `jobId`+`crawlRunId` im Serverless-Drain |

---

## 3. Sprint B — Connector-Verträge & echte Provider  · **CONTRACT-EBENE ERLEDIGT** (PR #42)

| # | Punkt | Status | Befund |
|---|---|---|---|
| B1 | `connector_sync` planbar + idempotent | ✅ | erledigt (PR #34) |
| B2 | Provider-Contract (Auth-Status, Quota, Freshness, Sync-Evidenz) | ✅ | `describe()` pro Connector + `GET /integrations/:id` + `connector-contract.md` |
| B3 | GSC/PSI/Lighthouse als echte API/Store-Integration | 🟡 | typisierte Schnittstelle steht, **Lighthouse registriert**; bleibt Stub — nur echtes `fetch()` fehlt (credential-gated) |
| B4 | Failure-Modes (fehlende Creds, Quota, degradiert) sichtbar | ✅ | typisiert + über Status-Endpoint abfragbar (kein Crash) |

> Verbleibend: echtes `fetch()` pro Provider + Credentials (DEC-002). Alles andre steht.

---

## 4. Sprint C — Technical-Audit-UI operativ  · **WEITGEHEND ERLEDIGT** (PR #40, #43)

| # | Punkt | Status | Befund |
|---|---|---|---|
| C1 | Pagination/Limits (Crawl-Runs, URL-Explorer, Issues) | ✅ | URL-Explorer-Screen + serverseitige Pagination (URLs + Crawl-Runs); Issue-Liste bleibt gruppiert |
| C2 | Detail-Drawer mit Fetch/Indexability/Rule/Run-Kontext | ✅ | URL-Drawer (Fetch/Indexability/Discovery) + Issue-Drawer (Rule/Historie) |
| C3 | Serverseitige Filter (Status/Severity/Rule/URL/Run) | 🟡 | Status+Severity (mit UI) ✅; Rule server-seitig ohne UI; URL/Run-Filter-UI offen |
| C4 | Issue-Aktionen: Dismiss-Grund, Actor, Historie | ✅ | distinkter Dismiss + Grund + Actor + Lifecycle-Historie (PR #43) |
| C5 | Empty/Error/Loading-States | 🟡 | Empty + **Loading** (`loading.tsx`) ✅; Action-`?error=`-Rendering noch offen |

---

## 5. UX/Backend-Tiefe (Roadmap-Reste)  →  [`../design/ux-ui-sprint.md`](../design/ux-ui-sprint.md)

- **UX-6b Crawl-Diff** (neues Backend) — ✅ **erledigt** (PR #45 Backend, #46 UI). As-of-Lifecycle-Diff zweier Runs + Vergleichs-UI. *(Bewusste Lücke: „entfernte URLs" nicht ableitbar ohne Per-Run-Snapshot.)*
- **UX-7 Content Workspace** — ✅ **erledigt** (PR #49 Backend, #50 UI). `/content-workspace`: Refresh-Kandidaten-Board, Content-Score-Gauge, manueller Brief-Editor (kein LLM-Auto-Gen — credential-gated), Term-Checkliste, interne Linkvorschläge (echter Linkgraph), Brief→Ticket/PR via MCP, Drill-down vom Opportunity Board. *(Bewusste Lücke: Auto-Brief-Generierung + echte GSC-Metriken folgen mit LLM/GSC-Credentials.)*

---

## 6. Hygiene & Querschnitt

- **GAP-SEC-001** — Dependency-Audit: ✅ `undici` (2× high) per non-breaking `npm audit fix` behoben (→ 7.28.0). Verbleibend: 2× **moderate** `postcss <8.5.10` (transitiv via `next`). **Bewusst akzeptiertes Restrisiko:** PostCSS läuft nur build-time, kein untrusted CSS-Input → keine reale Exposure; der `--force`-Fix (`next@9.3.3`) ist ein breaking Downgrade und tabu. Echter Fix kommt automatisch mit dem nächsten regulären Next-Upgrade.
- **Code-Hygiene:** ✅ Legacy-SQLite-Namen umbenannt (PR #38). Rest-Notiz: `stackDecision.database`-String in `packages/shared-config` nennt noch „SQLite embedded".
- **Doku-Hygiene:** ✅ abgeschlossen (URL-Drift, SQLite-Default-Sprache, Wave-Status, Handoff→Roadmap).

---

## 7. GAP-Register (aktualisiert; kanonische Historie: `_archive/roadmap-m0-m6.md`)

| ID | Bereich | Stand 2026-06-25 |
|---|---|---|
| GAP-PERSIST-001 | Persistenz | ✅ **geschlossen** (Neon + async) |
| GAP-REPORT-003 | Cron-Trigger | ✅ Mechanik vorhanden — `run-due`-Verdrahtung noch prüfen |
| GAP-AUTHZ-001 / WP-Z.1 | Security | ✅ implementiert (default OFF); Scharfschalten = Web-Token-Forwarding |
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
