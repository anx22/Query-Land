# Paralleler Ausführungsplan — Phase 2 Härtung

> Stand: 2026-06-25 · Begleitet [`roadmap.md`](./roadmap.md).
> Zweck: die offenen Punkte so schneiden, dass sie **parallel von mehreren Agents/LLM-Sessions**
> abgearbeitet werden können — minimale Datei-Kollision, klare Abhängigkeits-Wellen.
> Prinzip pro Track: **ein großer Anker-Task + viele kleine Satelliten-Tasks.**

---

## Konflikt-Karte (warum dieser Schnitt)

Parallelität funktioniert nur, wenn Tracks **disjunkte Dateibereiche** anfassen:

| Track | Hauptsächlicher Dateibereich | Kollidiert mit |
|---|---|---|
| T1 AuthZ | `apps/api/src/app.ts`, `…/middleware`, `…/stores/auth-store.ts` | T0 (Rename), T4 (Actor-Seam) |
| T2 Worker | `services/crawler/**`, `apps/api/src/stores/job-store.ts` | T0 (Rename) |
| T3 Audit-UI | `apps/web/**` | T4 (Web-Teil), T0 (nein) |
| T4 Issue-Lifecycle | `infra/db/postgres` + `…/crawl-store.ts` + `apps/web` | T1 (Actor), T3 (Drawer) |
| T5 Connectors | `apps/api/src/connectors/**` | T0 (Rename) |
| T6 Hygiene/Audit | Docs + Dependencies | — |
| T0 Rename (SQLite→PG) | breit über `apps/api/**` | T1, T2, T5 |

**Folge:** Der breite Rename (T0) und das AuthZ-Gate (T1, legt die Actor-Seam) sind **Serialisierungspunkte**. Alles andere fächert auf.

---

## Wellenplan

### Welle 0 — Mechanische Vorarbeit (seriell, schnell, allein)
**T0 — Anker:** `sqlite-store.ts`/`SQLiteStore`/`migrate-sqlite.ts` → Postgres-konforme Namen umbenennen (rein kosmetisch, Verhalten unverändert).
Kleine Tasks: Symbol-Rename, Importe nachziehen, `npm run check` grün, ein Commit.
*Warum zuerst:* breiter Diff über `apps/api/**`; wenn er **vor** den API-Tracks landet, bauen alle auf sauberen Namen auf und es gibt keine Rebase-Schmerzen. (Alternativ ganz ans Ende — aber nicht mittendrin.)

### Welle 1 — Voll parallel (4 Agents, disjunkt)

**T1 — AuthZ Session-Gate (P0)** · Bereich: API-Eingangsschicht
- **Anker:** Middleware-Gate für alle Nicht-`/auth`/`/health`-Routen, `AUTH_GATE_ENABLED`-schaltbar, Session-Kontext (Actor) in den Request-Scope legen.
- klein: `cleanupExpiredSessions` per Cron verdrahten · Audit-Log für 401 · 401/200-Tests zuerst · `AUTH_GATE_ENABLED`/Vercel-Env-Doku · OpenAPI-Security-Notiz.
- *liefert die Actor-Seam für T4.*

**T2 — Worker/Crawler härten** · Bereich: `services/crawler` + `job-store.ts`
- **Anker:** echter robuster Crawl gegen reale Test-Site (Retry mit **Exponential-Backoff**, Timeout, Failure-Mode-Abdeckung) + definiertes Smoke-Ziel + Kriterien.
- klein: Bugfix `robots.ts:35` (UA-Gruppen akkumulieren) · echten `User-Agent`-Header senden · Sitemap-Edge-Cases · Korrelations-ID + Per-Zyklus-Log im Serverless-Drain · `worker-smoke.md` auf Neon/Cron-Modell aktualisieren.

**T3 — Technical-Audit-UI** · Bereich: `apps/web` (nur lesend/anzeigend)
- **Anker:** URL-Explorer-Screen mit serverseitiger **Pagination** + URL-Detail-Drawer (Fetch/Indexability/Run-Kontext).
- klein: Pagination-Controls für Crawl-Runs & Issue-Liste · Rule-/URL-Filter-UI (Server-Filter existieren) · Issue-Drawer um Fetch/Indexability/Run anreichern · `loading.tsx`/Suspense · Action-`?error=` rendern.

**T5 — Connector-Verträge** · Bereich: `apps/api/src/connectors`
- **Anker:** Provider-Contract (Auth-Status, Quota, Freshness, Sync-Evidenz) als echte API/Store-Schnittstelle + **ein** Real-Adapter end-to-end vorbereitet (GSC), `fetch()` als einzige Credential-Lücke.
- klein: Lighthouse-Connector registrieren · PSI-Adapter-Skelett · Failure-Modes (fehlende Creds/Quota/degradiert) sichtbar · Contract dokumentieren.
- *credential-gated: alles außer echtem `fetch()` ist jetzt baubar.*

### Welle 2 — Nach Abhängigkeiten

**T4 — Issue-Lifecycle-Tiefe** · braucht T1 (Actor) **und** T3 (Drawer)
- **Anker:** echte Dismiss-Semantik — eigener Zustand + `dismiss_reason` + Actor + Historie (Migration `013` + API + UI).
- klein: `resolve` vs `dismiss` im Store trennen · `dismiss_reason`-Spalte (Migration) · Actor aus Session-Scope (← T1) statt `"system"` · Per-Issue-Historie-Query · im Drawer (← T3) anzeigen.
- *Schema/Store-Teil kann früh in Welle 1 starten; UI-/Actor-Integration erst nach T1+T3.*

### Durchgehend / unabhängig
**T6 — Hygiene & Dependency-Audit** (jederzeit, kein Code-Konflikt)
- **Anker:** GAP-SEC-001 — `npm audit` Next/PostCSS-Findings bewerten & entscheiden.
- klein: Spec-Header-Status auffrischen (14 `specs/*` sind dünne Vorläufer der `architecture/`-Docs) · 3 thin specs (`ai-visibility`/`backlink-intelligence`/`reporting-alerting`) auf ihre `architecture/`-Pendants verweisen · `reporting-alerts.md` GAP-Notizen (async/cron) auffrischen · `_archive/serverless-persistence-turso.md` als „superseded (Neon)" markieren oder entfernen.

---

## Abhängigkeits-Graph (kompakt)

```
T0 (Rename) ─┬─► T1 (AuthZ) ───────┐
             ├─► T2 (Worker)        ├─► T4 (Issue-Lifecycle)
             └─► T5 (Connectors)    │
T3 (Audit-UI) ───────────────────────┘
T6 (Hygiene) … unabhängig, jederzeit
```

## Empfohlene Reihenfolge für eine LLM-Session
1. **T0** allein (ein kurzer Commit) — Namensbasis sauber.
2. **T1 · T2 · T3 · T5** als 4 parallele Agents (disjunkt) — je 1 PR.
3. **T4** sobald T1 + T3 gemerged sind.
4. **T6** als Lückenfüller dazwischen (read-only/Docs/Deps).

**Pro Track gilt:** Tests zuerst, `npm run check` + `build:web` grün, eigener PR, Preview→Merge. So bleibt jeder Track unabhängig review- und mergebar.
