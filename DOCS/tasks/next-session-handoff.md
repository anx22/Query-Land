# Übergabe für die nächste Sprint-Session

Stand: 2026-06-06

## 1. Aktueller Projektstand

Die Codebasis ist nach dem Worker-v0- und Technical-Audit-UI-Slice grundsätzlich lauffähig und die Kernverträge sind stabil genug für die nächsten Sprints. Der aktuelle Stand kombiniert Wartbarkeitsarbeit mit einem vertikalen Welle-2-Slice:

- `apps/api/src/app.ts` ist wieder als schlanker Composition-/Error-Boundary-Einstieg gedacht.
- Request-Parsing und Validierung liegen in `apps/api/src/request-validators.ts`.
- Projekt-/Site-/Crawl-Routing liegt in `apps/api/src/routes.ts`.
- HTTP-Antworten, Request-IDs und Logging liegen in `apps/api/src/http.ts`.
- SQLite-Row-Mapping liegt in `apps/api/src/sqlite-mappers.ts`; `sqlite-store.ts` behält Store-Verhalten, Transaktionen/SQL und Scope-Checks.
- Web-Demo-Komponenten wurden in kleinere Presentational Components zerlegt (`MetricCard`, `InfoCard`, `StatusList`).
- Technical-Audit-UI liest echte Crawl Runs, Health Scores, Audit Issues und URL-Explorer-Daten aus API/SQLite.
- Worker v0 kann `crawl_seed`-Jobs claimen, Crawl-Artefakte schreiben, Health berechnen und Runs abschließen; offen sind Robustheit, echte Site-Smokes und Betrieb.
- Technical-Audit-Start nutzt nun eine gemeinsame Scheduling-Seam: API erstellt Crawl Run und typed `crawl_seed` Job zusammen. Legacy-Worker-Jobs ohne `crawlRunId` bleiben erlaubt; der Worker legt dann selbst einen Crawl Run an.
- Domain-Sprache wurde in `CONTEXT.md` ergänzt. Zukünftige Architektur-Reviews sollen diese Begriffe verwenden und neue load-bearing Begriffe dort nachziehen.
- Browser-/Vercel-Smokes sollen gegen `https://queryland-inky.vercel.app/` laufen, wenn eine echte Deployment-Prüfung sinnvoll ist.

## 2. Qualitätslage nach der Bestandsaufnahme

### Sauber / belastbar

- TypeScript-Projektreferenzen und Node-Test-Suites laufen über den Root-Check.
- API, Store und Domain Model haben einen gemeinsamen Crawl-Kontrakt für Crawl Runs, Discovery, Fetches, Indexability, Audit Issues und Health Scores.
- Worker-v0 und Technical-Audit-UI bilden einen vertikalen Welle-2-Slice, der ohne manuelle API-Aufrufe sichtbar wird.
- Die neue Modulgrenze reduziert das Risiko, dass weitere Sprints `app.ts` und `sqlite-store.ts` noch größer und schwerer testbar machen.

### Weiterhin technische Schulden

- `sqlite-store.ts` ist trotz ausgelagerter Mapper noch SQL- und Use-Case-lastig. Die nächste sinnvolle Zerlegung ist pro Aggregate/Repository: Auth, Project/Site, Crawl Artifacts, Jobs/Integrations.
- API-Routing nutzt noch manuelles Regex-Matching. Das ist für den aktuellen Umfang akzeptabel, sollte aber bei weiteren Endpoint-Gruppen in deklarative Route-Tabellen oder einen kleinen Router überführt werden.
- Request-Validierung ist bewusst leichtgewichtig, aber nicht schema-getrieben. Bei wachsendem OpenAPI-Umfang sollten Validatoren aus gemeinsamen Schemas/Contracts abgeleitet oder zentral getestet werden.
- Technical-Audit-UI ist v0: Runs, Health, Issues und URL Explorer sind sichtbar; Resolve/Dismiss/Reopen sind bedienbar, aber Detail Drawer, zusätzliche serverseitige Filter und getrennte Dismiss-Reason-Historie fehlen.
- Worker v0 ist vorhanden, aber noch nicht als robuster Betrieb gegen echte Sites nachgewiesen; echte Site-Smokes, Robots-/Sitemap-Details, Daemon-Verhalten und Run-/Job-Korrelation fehlen.
- `crawl_seed` Payloads sind typed, aber absichtlich zweistufig: Scheduling-Jobs tragen `crawlRunId`; ältere/programmatische Jobs dürfen ohne `crawlRunId` starten und werden vom Worker vervollständigt. Diese Kompatibilität nicht versehentlich entfernen.
- Security-, Session-, Connector- und AuthZ-Aspekte sind noch Foundation-Level und nicht production-grade.

## 3. Empfohlene nächste Sprint-Reihenfolge

### Sprint A — Repository- und Store-Schnitt weiter härten

Ziel: `sqlite-store.ts` unter Kontrolle halten, ohne Verhalten zu verändern.

1. Store in Aggregate-Module schneiden:
   - `auth-store` für User/Sessions.
   - `project-store` für Projects/Sites.
   - `crawl-store` für Crawl Runs, Discovered URLs, Fetch Results, Indexability, Issues, Health Scores.
   - `foundation-jobs-store` für Integrations, Jobs, Source Map.
2. Gemeinsame Scope-Assertions konsolidieren.
3. Für jeden Aggregate-Slice API-Tests als Regression-Schutz beibehalten.
4. Keine neuen Crawl-Features in denselben Commit mischen.

### Sprint B — Worker stabilisieren und Gate nachweisen

Ziel: Worker v0 von einem funktionierenden Slice zu einem reproduzierbaren Welle-2-Gate mit Fixture- und echter-Site-Smokes härten.

1. Bestehenden `crawl_seed`-Worker-v0 als wiederholbaren Fixture-Smoke dokumentieren und automatisieren.
2. Echte eigene Test-Site als Smoke-Ziel definieren und Run-Kriterien festhalten.
3. Retry-/Timeout-/Failure-Modes für Network Error, ungültige Sitemap und Robots-Blocker härten.
4. Robots-/Sitemap-Details inklusive Sitemap-Index und User-Agent-Gruppen ausbauen.
5. Betriebsmodus klären: Startscript/Daemon, Logs, Run-/Job-Korrelation und Exit-/Retry-Verhalten.

### Sprint C — Technical Audit UI operativ härten

Ziel: Die vorhandene Technical-Audit-UI von v0-Transparenz zu operativer Nutzbarkeit ausbauen.

Aktueller Stand: Technical-Audit-UI zeigt bereits Crawl Runs, Health, Issues und URL Explorer aus echten API-/SQLite-Daten.

1. Pagination oder harte Limits für Crawl Runs, URL Explorer und Issue-Liste ergänzen.
2. URL-/Issue-Detail Drawer mit Fetch-, Indexability-, Rule- und Run-Kontext bauen.
3. Serverseitige Filter für Issue-Status, Severity, Rule, URL und Run/Site-Kontext ergänzen.
4. Issue-Aktionen nachziehen: Resolve/Dismiss/Reopen sind vorhanden; offen bleiben Dismiss-Gründe, Actor-Kontext und Historie.
5. Empty/Error/Loading States für die neuen Listen-/Detailzustände nachziehen.

## 4. Do-not-break-Hinweise

- Domain-Model-Typen sind aktuell die zentrale Vertragsquelle zwischen API, Store, Crawler und UI. Änderungen zuerst dort und in OpenAPI/Docs nachvollziehen.
- SQLite-Schema-Änderungen nur mit Migrationsstrategie dokumentieren; keine stillen Spalten-/Constraint-Änderungen ohne Tests.
- Bestehende API-Pfade aus `DOCS/openapi/internal-api.yaml` nicht umbenennen, solange UI/Worker noch darauf aufbauen.
- Demo-Fixtures nicht als Produktlogik behandeln; bestehende echte Technical-Audit-Datenintegration nicht wieder durch Fixture-Daten ersetzen.
- `CONTEXT.md` ist die Domain-Vokabular-Datei. Wenn neue Begriffe wie Issue Lifecycle, Source Anchor oder Crawl Seed Scheduling geschärft werden, dort und in den passenden DOCS/tasks nachziehen.
- Der Backend Proxy Adapter muss Query-Strings erhalten; sonst unterscheiden sich Browser- und interne API-Interfaces bei Pagination/Filtern.

## 5. Pflicht-Checks vor Übergabe

Vor dem nächsten Übergabe-Commit sollten mindestens laufen:

```bash
npm run check
npm --workspace @seo-tool/web run build
```

Bei Dependency-/Security-Arbeiten zusätzlich:

```bash
npm audit --audit-level=moderate
```

Bekannte Einschränkung: Die Next/PostCSS-Audit-Meldungen müssen separat bewertet werden, weil ein automatischer `npm audit fix --force` Breaking-Änderungen auslösen kann.
