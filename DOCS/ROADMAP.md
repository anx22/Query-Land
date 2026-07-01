# Roadmap — Stand & Nächstes

> Stand: 2026-07-01 · **Was war, was ist, was kommt.**
> Produkt/Scope: [`PRODUCT_MASTER_SPEC.md`](./PRODUCT_MASTER_SPEC.md) · Architektur-Nahtstellen:
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) · Entscheidungen: [`DECISIONS.md`](./DECISIONS.md).

## Was steht (Vergangenes)

Alle sieben Produkt-Wellen sind implementiert; das Fundament ist in der Vercel-Produktion verifiziert.

| Bereich | Stand |
|---|---|
| Persistenz | ✅ **Neon Postgres** (Prod), embedded PGlite (lokal/Tests); Treiberwahl per `DATABASE_URL` |
| Store-Schicht | ✅ vollständig async |
| Serverless Crawl-Worker | ✅ in-process via Vercel-Cron `/api/cron/crawl` (täglich, `CRON_SECRET`) |
| Job-Robustheit | ✅ Lease + Stale-Reclaim + Dead-Letter (attempts ≤ 3) |
| Connector-Sync | ✅ tagesidempotent; echte GSC/PSI/Lighthouse-Adapter (async, credential-gated) |
| Technical Audit | ✅ URL-Explorer + Pagination + Drawer, serverseitige Filter/Suche, Issue-Lifecycle, Crawl-Diff |
| Content Workspace | ✅ Refresh-Board, Score-Gauge, manueller Brief-Editor, Linkvorschläge, MCP-Bridge |
| Reporting & Alerts | ✅ Reports (CSV/HTML/PDF), Alert-Regeln/-Events, Schedule `run-due` (Cron-getriggert) |
| AI Visibility & AEO | ✅ Prompts/Snapshots, AI-Visibility-Score (Klasse E), AEO-Checks (Klasse A), Proposals |
| Backlinks & Authority | ✅ Snapshot-Diff (New/Lost), Authority-Summary (GSC-Stub, Klasse B) |
| AuthZ-Gate | ✅ implementiert, `AUTH_GATE_ENABLED` (default OFF) |
| Härtung | ✅ app-weiter Bug-Audit + Fixes; Empty≠Error-Surfacing (Referenz: Technical Audit) |
| Google-OAuth-Flow (GSC) | ✅ Web-Flow vorhanden; wird live, sobald die 4 OAuth-Env-Vars gesetzt sind |
| Tests | ✅ Node + Web grün (`npm run check`, `@seo-tool/web test`) |

## Was fehlt zum Scharfschalten (Momentanes)

Das Produkt läuft; „live-echt" wird es mit **Credentials**, nicht mit Umbau:

- **GSC-OAuth-Credentials** — 4 Env-Vars in Vercel (`GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
  `OAUTH_ENCRYPTION_KEY`) → der GSC-Connect-Button wird aktiv, echte Klicks/Impressionen/Positionen
  fließen. Anleitung: [`deployment/google-oauth-setup.md`](./deployment/google-oauth-setup.md).
- **AuthZ scharf** — Web-Layer muss das Session-Token bei serverseitigen API-Calls weiterreichen, dann
  `AUTH_GATE_ENABLED=true`. Erst danach ist der Actor echt (statt `"system"`).
- **PSI-API-Key** (optional) — schaltet echte Web-Vitals statt Stub frei.
- **Empty≠Error-Muster** auf die übrigen Modul-Loader ausrollen (overview/backlinks/keywords/reports/content).

## Was noch offen ist (Geplantes / GAP)

| ID | Bereich | Stand |
|---|---|---|
| DEC-002 | externe Provider | Stubs aktiv; echte SERP/Backlink/LLM-Provider erst mit Lizenz/Credentials |
| GAP-AI-001 | LLM-Provider | offen — echter LLM statt Stub (Content-Auto-Brief hängt daran) |
| GAP-AI-003 | MCP-Write | offen — echtes Ticket-/PR-Backend hinter `accept` |
| GAP-REPORT-002 | Delivery | offen — echter SMTP/Slack-Adapter |
| GAP-AUTH-002/-003 | Authority | offen — Drittanbieter-Backlinks (Lizenz), Competitor-Gap |
| GAP-LINK-001 | Crawler | offen — Linkgraph-Befüllung |
| DEC-008 | Mandanten/GSC-Ownership | offen — User-/Rollen-Isolation vor Öffnung für externe Nutzer |
| GAP-SEC-001 | Security | `postcss` (moderate, transitiv via `next`) — build-time, akzeptiertes Restrisiko bis zum nächsten Next-Upgrade |

## Do-not-break

- Domain-Model-Typen (`packages/domain-model`) sind die zentrale Vertragsquelle (API/Store/Crawler/UI) —
  Änderungen zuerst dort + `openapi/internal-api.yaml`.
- Postgres-Schema nur per **neuer** versionierter Migration unter `infra/db/postgres/`.
- `crawl_seed`-Kompatibilität: geplante Jobs tragen `crawlRunId`; ältere Jobs dürfen ohne starten (DEC-006).
- API-Pfade aus `openapi/internal-api.yaml` nicht umbenennen, solange UI/Worker darauf bauen.
- Backend-Proxy-Adapter muss Query-Strings erhalten (sonst divergieren Browser- und interne API).

## Pflicht-Checks vor Übergabe

```bash
npm run check
npm --workspace @seo-tool/web run build
```
