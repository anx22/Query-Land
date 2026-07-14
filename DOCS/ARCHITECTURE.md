# Architektur — die tragenden Entscheidungen

> Zweck: die **großen Nahtstellen und Erkenntnisse** festhalten, die man nicht aus dem Code
> herauslesen kann. Kein Route-für-Route-Katalog — der lebt im Code (`apps/api/src/routes/*`) und im
> API-Vertrag (`openapi/internal-api.yaml`). Wahrheitsebene fürs Produkt bleibt der
> [`PRODUCT_MASTER_SPEC.md`](./PRODUCT_MASTER_SPEC.md); der aktuelle Baustand steht im
> [`ROADMAP.md`](./ROADMAP.md).

## 1. Confidence-Firewall (der zentrale Designpunkt)

Jede Datenquelle trägt eine Vertrauensklasse (Master-Spec §2.7): **A** eigene Daten · **B** Google/eigene
API · **C** beobachtete SERP · **D** Drittanbieter-Schätzung · **E** LLM-Interpretation.

Die Firewall ist eine **harte Regel, kein Label**: Klasse E ist niemals Opportunity-Evidenz.
- **LLM-Antwort-Snapshots** und der daraus verdichtete **AI-Visibility-Score** sind Klasse E — reines
  Monitoring-Signal in der UI, wird **nicht** an den Opportunity-Generator übergeben.
- **AEO-Assessments** (`analyzeAeo` wertet nur den übergebenen Seiteninhalt aus, keine externen Calls,
  keine Zufallskomponente → reproduzierbar) sind Klasse A und speisen die harte Opportunity-Klasse `aeo`.

Konsequenz: KI-Sichtbarkeit ist ehrlich als Signal gekennzeichnet und darf keine Maßnahme „belegen".
Opportunities entstehen nur aus A–C-Evidenz.

## 2. Stub → Real-Seam der Connectors (warum nichts umgebaut werden muss)

Jeder Connector erfüllt einen typisierten Vertrag (`describe(ctx)` → `ConnectorContract` mit `authStatus`,
`quota`, `freshness`, `capabilities`; `fetch(ctx)` ist **async**). Der einzige Baustein, der real wird,
ist der Netzwerk-Call:

- Echte Adapter (`connectors/adapters.ts`) laufen **nur**, wenn echte Credentials/Env auflösbar sind
  (`credential-resolution.ts`). Sonst fällt `fetch()` byte-für-byte auf den deterministischen Stub zurück.
  Ohne Credentials ist das Verhalten unverändert — deshalb ist „Stub in Produktion" kein Bruch.
- Live-Quellen: `gsc` → Search-Analytics-API (Klicks/Impressionen/CTR/Position), `pagespeed`/`lighthouse`
  → PageSpeed Insights v5 (Web Vitals + Kategorien).
- **Failure-mode-Sichtbarkeit:** Netzwerkfehler/Quota/abgelaufen werfen nie roh, sondern werden zu
  sichtbaren Outcomes (`401→expired`, `429→quota_exceeded`, sonst `degraded`). Der Sync crasht nicht,
  setzt den Account auf `degraded`, schreibt ein Audit-Ereignis — UI/Agent sehen einen abfragbaren
  Zustand statt einer opaken 502.

Dieselbe Naht gilt für alle Provider-Schichten (SERP, Backlinks, Report-Delivery, LLM): das Stub liefert
deterministische Daten, der echte Provider ersetzt nur den einen Call — ohne Schema- oder API-Änderung.

## 3. Die Opportunity-Schleife (worum sich der Output dreht)

Alle Module münden in **ein** Objekt (Master-Spec §6): Beobachtung → Evidenz → Ursache → Priorität →
Maßnahme → Validierung. Statusmodell:
`open → planned → in_progress → implemented → validated | reopened | dismissed | expired`.

Beim Übergang auf `implemented` schedult das System einen **asynchronen** Re-Check (GSC-Delta 3–14 Tage
Latenz, §2.10) und setzt selbst auf `validated` oder `reopened`. Statusübergänge sind an **einer** Stelle
definiert (`packages/domain-model/src/opportunities.ts`, `OPPORTUNITY_STATUS_TRANSITIONS`) — Store und UI
teilen diese Quelle, damit UI und Backend nie divergieren.

## 4. Reporting/Alerts sind Aggregate — Confidence ist transitiv

Ein Report bündelt bestehende Modul-Daten (Health, Opportunities, Visibility, Authority) in typisierte
`ReportSection`s; Export (CSV/HTML/PDF) sind **dependency-freie** reine Funktionen (`renderReportExport`).
Alert-Events **erben** die Confidence-Klasse ihrer Quellmetrik: ein Alert auf `visibility_score` ist so
gut wie der SERP-Stub darunter. Solange die Provider Stubs sind (DEC-002), ist das gesamte Reporting
Klasse B — und wird auch so ausgewiesen.

Scheduling: `POST /report-schedules/run-due` ist **idempotent** (rückt `next_run_at` sofort vor) und wird
extern getriggert — in Produktion vom Vercel-Cron. Kein In-Environment-Daemon.

## 5. Agent/MCP: read-first, Schreiben nur über Freigabe

UI und Agent teilen denselben API-Kern. MCP-Lesetools sind frei; **Schreibtools erzeugen ausschließlich
`proposals`-Zeilen im Status `proposed`** und lösen keinen Statusübergang aus — jede Produktionswirkung
braucht eine menschliche Review-Aktion (`accept`/`reject`). Dieses Gate ist im Handler strukturell
erzwungen, nicht nur konventionell (Master-Spec §4.4).

## 6. Known Pitfalls — Engineering-Guardrails

Aus dem app-weiten Bug-Audit; gelten für jedes neue Modul:

- **Empty ≠ Error.** Web-Loader dürfen einen fehlgeschlagenen Fetch nicht still zu „leer" verschlucken
  (`.catch(() => [])`), sonst rendert die UI einen falschen Gesund-Zustand. Fehler pro Sektion mitführen
  und sichtbar machen. (Referenz-Fix: Technical Audit; Muster auf alle Loader ausrollen.)
- **Async-Nähte ganz verdrahten.** Provider-`fetch()` ist `T | Promise<T>` — erst `await`, dann prüfen;
  nie Truthiness auf einem evtl. un-awaiteten Promise.
- **Kein ungeschützter Transport-/Store-Zugriff.** API-Antwort erst auf Status prüfen, dann `data`
  lesen; `JSON.parse` über einen `safeJson`-Helfer; Enum-Werte aus der DB vor `[key]`-Zugriff validieren.
- **Keine festen Entity-IDs außerhalb von Tests.** Tests provisionieren ihre Fixtures selbst und nutzen
  die zurückgegebenen IDs (der ursprüngliche Smoke-Bug: angenommenes Demo-Seed → 404).

## 7. Nahtstellen-Fehlerklasse + die drei GSC-Datenpfade

Der app-weite Audit fand eine **Fehlerklasse an den Daten-Nahtstellen**: jede Funktion für sich korrekt,
aber Writer↔Reader-Vertrag, Auslöser oder Erfolgs-Copy passen nicht zusammen (was isolierte Code-Reviews
nicht sehen). Archetypen: **A1** falscher Speicher · **A2** kein Producer · **A3** toter Speicher (kein
Reader) · **A4** Aktion meldet Erfolg ohne Wirkung · **A5** hartkodierter Platzhalter mit Befüllungs-
Versprechen · **A6** echte Route ohne Auslöser.

**GSC hat drei getrennte Datenpfade** — Verwechslung ist die häufigste A1-Quelle:
1. **Connector-Sync** → `normalized_metrics` (Aggregat je Property/Site; darüber liegen u. a. die
   PSI/Web-Vitals als `entity_type='site' + metric psi_*`).
2. **SERP-Provider** → `rank_snapshots`/`serp_snapshots`/`visibility_scores` (Positionen, Sichtbarkeit).
3. **Search-Performance-Sync** → `search_performance_rows` (Klicks/Impressionen je URL; speist Content-
   Workspace + Opportunities). Zusätzlich **URL-Inspection** → `url_index_status` (Index-Abdeckung,
   `webmasters.readonly`, Quota 2000/Tag hart gedeckelt).

Wer eine dieser Tabellen liest, muss den passenden Sync-Pfad triggern (OAuth-Callback, „Jetzt
synchronisieren", täglicher Cron via `lib/gsc-refresh.ts`). Erfolgs-Copy **an das echte Ergebnis koppeln**
(`inserted`/`created`-Count), nie optimistisch melden.

**Guard:** `lib/__guard__/no-dead-loaders.test.ts` verhindert Rückfall — (a) kein `load*`-Loader in
`features/*/api.ts` ohne echten Importeur (Screen-Loader gehören nach `lib/*-api.ts`), (b) jeder
`redirect(?param=…)`-Erfolgsparameter einer `actions.ts` muss von der zugehörigen `page.tsx` gelesen werden
(keine tote Erfolgs-Copy).

**Backend-fertig, aber (noch) ohne UI-Auslöser** (bewusst als Roadmap, nicht als Leiche): `map-url`
(Keyword→URL), `orphan-urls`, `deploy-markers`, `pr-checks`-Historie, Report-Detailansicht,
`generate-indexability`, manuelles `createOpportunity`. Siehe `ROADMAP.md`.

## 8. Datenhaltung

Bei < 5k URLs/Property liegt **alles in Postgres** (inkl. Crawl-/SERP-/GSC-Historie) — bewusst **kein**
ClickHouse/Redis/Object-Storage (Master-Spec §9.2). Roh- und Normalisierte Daten bleiben getrennt.
Treiberwahl per `DATABASE_URL`: Neon (Produktion) bzw. embedded PGlite (lokal/Tests). Schemaänderungen
nur per neuer versionierter Migration unter `infra/db/postgres/`.
