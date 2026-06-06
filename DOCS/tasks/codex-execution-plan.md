# Codex-Ausführungsplan — sequenzierte Arbeitspakete bis MVP

> Zweck: Aus Bestandsaufnahme (Code) × Kernvision (`docs/PRODUCT_MASTER_SPEC.md`) × Roadmap (`tasks/roadmap-tracking.md`)
> abgeleitete, nach Komplexität/Abhängigkeit/Modul geschnittene Arbeitspakete (WP) mit kopierbaren Codex-Prompts.
> Jeder Prompt folgt dem Master-Prompt-Muster §12.3 (spec-first, vertikaler Schnitt, Tests zuerst, keine Vertragsänderung außerhalb des Scopes).
>
> Stand: 2026-06-06 · Quelle: Modul-Inventur (api/web/crawler/domain) + Master-Spec.

## Getroffene Weichenstellungen (Quiz)

| Frage | Entscheidung | Wirkung |
|---|---|---|
| Plattform-Typ (DEC-001) | **Content + SaaS** | Crawl-Fixtures (W2) und Opportunity-Klassen (W4) auf Content/SaaS zuschneiden; kein Shop-Facetten-Sonderfall vorerst |
| MCP/Agent-Timing (DEC-004) | **Nach Welle 4** | MCP-Tools erst bauen, wenn Opportunities existieren (sinnvolle `list_opportunities`/`explain_opportunity`) |
| AuthZ-Tiefe | **Single-Tenant intern, minimal — ans Ende verschoben** | Bewusst KEIN Login-Gate während der Entwicklung (schnelleres, login-freies Testen/Frickeln). Das minimale Session-Gate kommt als letztes Paket vor produktivem Einsatz; volle per-Projekt-RBAC noch später. |
| Vorgehen/Reihenfolge | **An Agent delegiert** | Sequenz siehe unten (Begründung: erst Gates + günstige Härtung, dann Opportunity-Rückgrat als konzeptionelles Zentrum, dann Wellen 3→7) |

Offen (später, blockieren nichts): DEC-002 (Provider), DEC-003 (Märkte — Empfehlung DACH), DEC-005 (Open-Source/Souveränität), GAP-PERSIST-001 (Turso/Neon vor produktivem Dauerbetrieb, siehe `architecture/serverless-persistence-turso.md`).

## Sequenz-Begründung

1. **M0 zuerst** — billig, hohe Hebelwirkung: die schon fast fertigen W1/W2-Gates formal schließen und die in der Roadmap unterrepräsentierten *gate-kritischen* Posten (interner Linkgraph, Web Vitals) nachziehen. Härten, bevor wir mehr darauf bauen. **AuthZ ist bewusst NICHT in M0** — kein Login-Gate während der Entwicklung, damit login-frei getestet werden kann (siehe „Spätestes Paket").
2. **M1 danach** — das **Opportunity-Rückgrat (§6)** ist das konzeptionelle Zentrum des Produkts. Früh ein minimales Rückgrat + den ersten Generator (§6.6, binär validierbarer Indexierbarkeits-Fix) zu bauen, lässt Audit-Issues schon als echte Opportunities entstehen und beweist den Validierungsloop — ohne die volle Welle 4. Minimale **Source Map** kommt mit, weil `source_anchor` ein Opportunity-Feld und der Differenzierer (§1.3) ist.
3. **M2→M6** folgen der Master-Wellen-Reihenfolge (Keyword → Opportunity-Engine-Vollausbau → Authority → Reporting → AI), MCP nach W4 eingeschoben.

> **Hinweis Persistenz:** Bis GAP-PERSIST-001 gelöst ist, sind echte Crawl-Daten auf Vercel ephemer. Für W2-Echt-Site-Smokes den Worker lokal oder gegen ein Ziel mit persistentem Speicher laufen lassen.

---

## Milestone-Leiter (geschärfte Roadmap)

| Milestone | Welle | Inhalt | Gate |
|---|---|---|---|
| **M0 Gates & Härtung** | 1–2 | W1-UI-Smoke, Worker-Härtung+Echt-Site-Smoke, Linkgraph, Web Vitals, Connector-Contract, Modularisierung+Tests (**ohne AuthZ**) | W1 & W2 Gates bewiesen, `npm run check` grün |
| **M1 Opportunity-Rückgrat** | 4 (vorgezogen) | Minimale Source Map real, Opportunity+Evidence-Schema/API, erster Generator + Re-Check-Scheduler, Opportunity Board v0 + URL Dossier v0 | Ein Indexierbarkeits-Fix durchläuft open→implemented→validated mit echter Vorher/Nachher-Messung |
| **M2 Keyword Core** | 3 | Keyword-Bibliothek+Clustering+Intent, Rank-Tracking+SERP-Snapshots/Diffs, Visibility-Index | tägliche Verläufe, Export, Alerts |
| **M3 Opportunity Engine + MCP** | 4 | Search-Performance-Intelligence (GSC), 5 Opportunity-Klassen, Prioritätsscore, Source-Map Pre-Merge-Gate, **MCP read-only** | jede Empfehlung mit Evidenz+Score+Validierungsmetrik; Agent beantwortet read-only Fragen |
| **M4 Authority** | 5 | GSC-Link-Import, Ref-Domain-Modell, New/Lost, Authority-Gaps | neue/verlorene Links nachvollziehbar |
| **M5 Reporting** | 6 | Report-Typen, Export PDF/CSV, E-Mail/Slack, Alerts | Wochenreport automatisiert |
| **M6 AI + MCP-Vollausbau** | 7 | Prompt/Citation/Mention/Referral, AEO, MCP-Schreibtools (reviewpflichtig) | Agent beantwortet echte SEO-Fragen über eigene Daten |

---

## Arbeitspakete M0 & M1 (startklar)

| WP | Modul | Komplexität | Abhängig von | Spec |
|---|---|---|---|---|
| WP-0.2 W1 UI-Smoke | web/test | S | — | UX_FLOWS.md |
| WP-0.3 Worker-Härtung + Sitemap-Index + Fixture/Echt-Smoke | crawler | M | — | crawl-engine.md |
| WP-0.4 Connector-Contract (GSC/PSI Stub real) | integrations/api | M | — | integrations.md |
| WP-0.5 Web Vitals (PSI/Lighthouse) | api/crawler/web | M | WP-0.4 | crawl-engine.md |
| WP-0.6 Interner Linkgraph | domain/api/crawler/web | M | WP-0.3 | crawl-engine.md |
| WP-0.7 Modularisierung + Kern-Tests | api/test | M | — | observability-sre.md |
| WP-1.1 Source Map real (minimal) | api/web | M | — | source-map.md |
| WP-1.2 Opportunity+Evidence Schema/API | domain/api | L | — | content-opportunities.md, §6 |
| WP-1.3 Erster Generator + Re-Check-Scheduler | crawler/api | M | WP-1.2 (1.1 optional) | §6.5/§6.6 |
| WP-1.4 Opportunity Board v0 + URL Dossier v0 | web | M | WP-1.2/1.3 | UX_FLOWS.md |

### Konventionen für jeden Codex-Prompt
- Wahrheitsebene `docs/PRODUCT_MASTER_SPEC.md`, Detailebene die genannte `specs/<spec>.md`.
- Tests zuerst; `npm run check` muss grün bleiben; keine API-Verträge außerhalb des Scopes ändern.
- Idempotente Jobs, Raw/Normalized getrennt, Confidence-Klassen taggen, Failure Modes + Migrationsschritte dokumentieren.
- Branch pro WP, kleiner PR, kein Merge ohne grüne Checks.

---

## Kopierbare Codex-Prompts

> **AuthZ ist bewusst ans Ende verschoben** (login-freies Testen). Der Prompt steht unter „Spätestes Paket — vor produktivem Einsatz" am Dokumentende.

### WP-0.2 — Welle-1-UI-Smoke
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§10 Welle-1-Gate) und docs/UX_FLOWS.md.
Scope: Automatisierter Smoke-Test, der das Welle-1-Gate beweist. Keine neuen Features.
Ist-Zustand: apps/web hat echte Foundation-Flows (Projects, Settings, Overview). Es fehlt ein reproduzierbarer Gate-Nachweis.
Aufgabe: Schreibe einen Node-Test (im bestehenden Teststil, in-memory SQLite über den embedded API-Handler), der end-to-end
prüft: Projekt anlegen -> Site anlegen -> Connector-Stub anlegen -> Job sichtbar -> erneuter Read hält die Daten.
Verwende die echten API-Routen, nicht Fixtures. Dokumentiere, wie der Smoke lokal läuft.
Akzeptanz: Test ist Teil von `npm test` und grün; deckt die fünf Schritte ab.
```

### WP-0.3 — Worker-Härtung + Sitemap-Index + Smoke
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§10 Welle-2-Gate, Modul 2) und specs/crawl-engine.md.
Scope: Robustheit des bestehenden crawl_seed-Workers (services/crawler), NICHT neue Module.
Ist-Zustand: Worker v0 macht seed+sitemap+fetch+indexability+6 Issue-Rules+Health (services/crawler/src/crawl-cycle.ts).
Lücken: kein Sitemap-Index (verschachtelte Sitemaps in sitemap.ts), Regex-HTML-Extraktion, kein Redirect-Loop-Schutz,
kein SIGTERM-Handler (worker.ts), kein Fixture-/Echt-Site-Smoke als Gate.
Aufgabe:
- Sitemap-Index-Unterstützung (sitemap.ts): <sitemap>-Verschachtelung auflösen, begrenzt + in-scope.
- Redirect-Loop-Erkennung mit Tiefenlimit in fetch-url.ts.
- Graceful Shutdown (SIGTERM) in worker.ts: laufenden Job sauber beenden/markieren.
- Dokumentierter, wiederholbarer Fixture-Smoke + Anleitung für einen Smoke gegen EINE echte eigene Content/SaaS-Site.
Tests zuerst für Sitemap-Index und Redirect-Loop.
Akzeptanz: npm run check grün; neue Tests grün; Fixture-Crawl läuft end-to-end mit persistierten Artefakten + Run-Summary.
Hinweis: Persistenz auf Vercel ist ephemer (GAP-PERSIST-001); Echt-Site-Smoke lokal/gegen persistentes Ziel ausführen.
```

### WP-0.4 — Connector-Contract real (GSC/PSI Stub)
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§4.2, §2.6, §2.7) und specs/integrations.md.
Scope: Das Connector-Interface real machen für ZWEI Provider als Stub: GSC (Klasse B) und PageSpeed/PSI (Klasse B).
KEINE echten OAuth-Flows; deterministische Stub-Daten genügen, Vertrag steht im Vordergrund.
Ist-Zustand: Integrationen sind reine DB-Stubs (apps/api/src/stores/project-store.ts), kein fetch/normalize/validate.
Aufgabe:
- Definiere ein Connector-Interface (source_type, auth_config, fetch, normalize, validate, quota_status, freshness).
- Implementiere GSC- und PSI-Stub-Connector hinter dem Interface; Rohdaten getrennt von normalisierten Daten speichern
  (raw_events vs normalized_metrics Tabellen existieren bereits, bisher ungenutzt).
- Connector-Sync-Job (connector_sync) im Worker tatsächlich verarbeiten (derzeit übersprungen).
Tests zuerst: normalize/validate/quota je Connector; Raw/Normalized-Trennung.
Akzeptanz: npm run check grün; connector_sync erzeugt normalisierte Metriken mit Confidence-Klasse B; Annahmen offengelegt.
```

### WP-0.5 — Web Vitals (PSI/Lighthouse)
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (Modul 2, §A.3) und specs/crawl-engine.md.
Scope: Core Web Vitals/Performance-Basiswerte (LCP/CLS/INP/TTFB) als Teil des Audits. Abhängig von WP-0.4 (Connector).
Aufgabe: Über den PSI-Connector (WP-0.4) pro URL/Site Web-Vitals-Werte als normalized metrics (page_metric) erfassen,
in der Technical-Audit-UI anzeigen, und in den Health-Score einfließen lassen (Gewichtung dokumentieren).
Tests zuerst: Mapping PSI-Stub -> page_metric; Health-Score-Einfluss.
Akzeptanz: npm run check grün; Technical Audit zeigt Web-Vitals je Site; Confidence-Klasse B getaggt.
```

### WP-0.6 — Interner Linkgraph
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (Modul 2) und specs/crawl-engine.md.
Scope: Interner Linkgraph als Welle-2-Gate-Posten. Abhängig von WP-0.3.
Ist-Zustand: Outgoing-Links werden extrahiert (link-extraction.ts), aber nicht als Graph persistiert/ausgewertet.
Aufgabe:
- Domain-Typen + Migration für interne Link-Edges (from_url, to_url, anchor, rel, depth).
- Worker persistiert Edges; API-Endpunkt liefert Inlinks/Outlinks je URL + Orphan-/Deep-URL-Auswertung (paginiert).
- Technical-Audit-UI: Orphan-/Deep-URL-Liste + Inlinks/Outlinks im URL-Kontext.
Tests zuerst: Edge-Extraktion, Orphan-Erkennung, Tiefe.
Akzeptanz: npm run check grün; Orphan-/Deep-URLs sichtbar; Edges paginiert abrufbar.
```

### WP-0.7 — Modularisierung + Kern-Tests
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§12) und specs/observability-sre.md.
Scope: Technische Schuld reduzieren, BEVOR neue Module dazukommen. Kein neues Feature.
Ist-Zustand: apps/api Routen/Validierung/Store wachsen in wenigen großen Dateien; Testabdeckung ~20% der Routen.
Aufgabe:
- apps/api/src/routes.ts in routes/* (nach Ressource) aufteilen; request-validators.ts in validators/* gruppieren;
  Store-Module bleiben getrennt. Keine Verhaltens-/Vertragsänderung.
- Strukturierte Logs mit requestId/jobId/runId-Korrelation.
- Tests ergänzen für: Project/Site-CRUD, Crawl-Run-Lifecycle, Audit-Issue-Filter/Resolve, Health-Score-Compute.
Akzeptanz: npm run check grün; Testabdeckung der Kern-CRUD-/Lifecycle-Pfade vorhanden; Diff ist reine Umstrukturierung+Tests.
```

### WP-1.1 — Source Map real (minimal)
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§4.3 — der Differenzierer) und specs/source-map.md.
Scope: Minimale, aber ECHTE Source Map (kein Read-only-Stub). Pre-Merge-Gate noch NICHT.
Ist-Zustand: source-map-store.ts ist read-only über geseedete Tabellen (source_repos, templates, url_template_map).
Aufgabe:
- API zum Anlegen/Aktualisieren von url->template->repo_pfad-Zuordnungen (manuell + einfaches heuristisches Matching
  aus Routing-Konfiguration).
- deploy_marker anlegen/auflisten (für spätere Crawl-/GSC-Deltas).
- UI: URL->Template->Repo sichtbar und pflegbar.
Tests zuerst: Mapping-Upsert, deploy_marker-Lifecycle.
Akzeptanz: npm run check grün; eine URL lässt sich einem Repo-Pfad zuordnen und wieder auflösen (source_anchor-fähig).
```

### WP-1.2 — Opportunity + Evidence (Schema/API)
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§6 — zentrale Einheit) und specs/content-opportunities.md.
Scope: Das Opportunity-RÜCKGRAT (Schema + API + Statusmodell). NOCH NICHT die fünf vollen Opportunity-Klassen.
Aufgabe:
- Domain-Typen + Migration für `opportunity` (Felder §6.2) und `evidence` (Felder §6.3, Confidence §2.7).
- API: Opportunities listen (paginiert, Filter Typ/Status/Site), lesen, Status-Übergänge §6.5
  (open->planned->in_progress->implemented->validated|reopened|dismissed|expired).
- Mindestens eine Evidenz Klasse A–C pro Opportunity erzwingen (§2.3).
Tests zuerst: Statusübergänge, Evidenz-Pflicht, Pagination/Filter.
Akzeptanz: npm run check grün; Opportunity inkl. Evidenz anlegbar/abrufbar; ungültige Übergänge abgelehnt.
```

### WP-1.3 — Erster Generator + Re-Check-Scheduler
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§6.5, §6.6) und specs/content-opportunities.md.
Scope: Der erste Opportunity-Generator mit BINÄRER Validierung. Abhängig von WP-1.2 (Source Map WP-1.1 optional für source_anchor).
Aufgabe:
- Aus Indexierbarkeits-Blockern (vorhandene Assessments/Issues) Opportunities vom Typ "technischer Fix" erzeugen,
  current_state="nicht indexierbar", validation_metric=Indexierbarkeit, ggf. source_anchor aus Source Map.
- Beim Übergang auf `implemented` einen Re-Check-Job (n Tage) schedulen; der Worker führt den Re-Check aus und setzt
  automatisch auf `validated` oder `reopened` (asynchron, §2.10).
Tests zuerst: Generierung aus Blocker, Re-Check setzt validated/reopened korrekt.
Akzeptanz: npm run check grün; ein Indexierbarkeits-Fix durchläuft open->implemented->validated mit Vorher/Nachher-Beleg.
```

### WP-1.4 — Opportunity Board v0 + URL Dossier v0
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§6) und docs/UX_FLOWS.md (Opportunity Board, URL Dossier).
Scope: Minimale UI für das Opportunity-Rückgrat. Abhängig von WP-1.2/1.3.
Aufgabe:
- Opportunity Board: priorisierte Liste mit Filtern (Typ/Status/Site), Evidence-Drawer, Validation-Drawer, Statuswechsel-Aktionen.
- URL Dossier v0: eine URL als Objekt — Crawlstatus, Indexability, Issues, Opportunities, Source-Anker, Historie.
Tests zuerst (soweit serverseitig sinnvoll): Lade-/Filterpfade.
Akzeptanz: npm run check grün; Board zeigt echte Opportunities und erlaubt Statuswechsel; URL-Dossier rendert echte Daten.
```

---

## M2–M6 — Prompt-Gerüste (werden bei Annäherung geschärft)

Für die Wellen 3–7 existieren bereits Basis-Prompts unter `prompts/codex-*.md`. Diese pro Welle nutzen und mit dem
dann-aktuellen Ist-Zustand-Delta ergänzen. Reihenfolge & Module:

- **M2 (W3, `prompts/codex-keyword-core.md`)**: WP-2.1 Keyword-Bibliothek+Clustering+Intent → WP-2.2 Rank-Tracking+SERP-Snapshots/Diffs (Provider-Abstraktion, kein lizenzierter Provider per DEC-002) → WP-2.3 Visibility-Index. Märkte: DACH (DEC-003, bis anders entschieden).
- **M3 (W4, `prompts/codex-opportunity-engine.md`)**: Search-Performance-Intelligence (braucht echten GSC-Connector) → fünf Opportunity-Klassen + Prioritätsscore (§6.4) → Source-Map Pre-Merge-Gate (PR-Check) → **MCP read-only** (`prompts/codex-ai-layer.md`, nur Tool-Teil): get_project_summary, get_url_dossier, list_opportunities, get_crawl_issues, explain_opportunity.
- **M4 (W5, `prompts/codex-backlink-layer.md`)**: GSC-Link-Import → Ref-Domain-Modell → New/Lost → Authority-Gaps.
- **M5 (W6, `prompts/codex-reporting.md`)**: Report-Typen → Export PDF/CSV → Versand E-Mail/Slack → Alerts.
- **M6 (W7, `prompts/codex-ai-layer.md`)**: Prompt/Citation/Mention/Referral-Tracking → AEO-Checks → MCP-Schreibtools (create_dev_ticket/propose_fix_pr, reviewpflichtig §4.4).

**Querschnitt vor produktivem Dauerbetrieb:** WP-Z.1 (AuthZ-minimal, siehe unten), GAP-PERSIST-001 (Persistenz-Dienst, `architecture/serverless-persistence-turso.md`) und volle per-Projekt-RBAC.

---

## Spätestes Paket — vor produktivem Einsatz

> Bewusst ganz am Ende: Während der gesamten Entwicklung läuft alles **ohne Login-Gate**, damit schnell und login-frei
> getestet werden kann. Erst unmittelbar vor produktivem Einsatz wird das minimale Session-Gate aktiviert.

### WP-Z.1 — AuthZ-minimal (Session-Gate, single-tenant)
```text
Nutze docs/PRODUCT_MASTER_SPEC.md (§4.1, §12.4) und specs/security-privacy.md als Detailebene.
Scope: NUR minimale Autorisierung für den internen Single-Tenant-Betrieb. KEINE volle per-Projekt-RBAC.
Ist-Zustand: Auth (scrypt, Sessions, Bearer-Token) existiert in apps/api/src/stores/auth-store.ts; Business-Endpunkte in
apps/api/src/routes.ts/app.ts haben bewusst KEIN Session-Gate (login-freie Entwicklung). Jetzt aktivieren.
Aufgabe:
- Führe eine Gate-Funktion in apps/api/src/app.ts ein, die für alle nicht-/auth- und nicht-/health-Routen einen gültigen
  Bearer-Token verlangt (über getUserBySessionToken). Ungültig/fehlend -> 401 im bestehenden Fehlerformat.
- Optional per ENV (z.B. AUTH_GATE_ENABLED) schaltbar, damit lokales login-freies Testen weiter möglich bleibt.
- Schreibe Audit-Log-Einträge (audit-log.ts) für abgelehnte Zugriffe.
- Rufe cleanupExpiredSessions() periodisch oder beim Login auf (derzeit tote Funktion).
Tests zuerst: Zugriff ohne/mit ungültigem/mit gültigem Token auf je einen Lese- und Schreib-Endpunkt.
Akzeptanz: npm run check grün; bei aktivem Gate geschützte Endpunkte ohne Token -> 401, mit Token -> wie bisher.
Lege alle Annahmen offen. Dokumentiere, was bewusst NICHT abgedeckt ist (per-Projekt-RBAC = noch späteres Paket).
```
