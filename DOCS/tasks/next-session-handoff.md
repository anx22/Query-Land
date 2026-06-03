# Übergabe für die nächste Sprint-Session

Stand: 2026-06-03

## 1. Aktueller Projektstand

Die Codebasis ist nach dem Crawl-Pipeline-Slice grundsätzlich lauffähig und die Kernverträge sind stabil genug für die nächsten Sprints. Der aktuelle QA-Refactor hat bewusst keine fachliche Crawl-Logik geändert, sondern die Wartbarkeit der bestehenden Implementierung verbessert:

- `apps/api/src/app.ts` ist wieder als schlanker Composition-/Error-Boundary-Einstieg gedacht.
- Request-Parsing und Validierung liegen in `apps/api/src/request-validators.ts`.
- Projekt-/Site-/Crawl-Routing liegt in `apps/api/src/routes.ts`.
- HTTP-Antworten, Request-IDs und Logging liegen in `apps/api/src/http.ts`.
- SQLite-Row-Mapping liegt in `apps/api/src/sqlite-mappers.ts`; `sqlite-store.ts` behält Store-Verhalten, Transaktionen/SQL und Scope-Checks.
- Web-Demo-Komponenten wurden in kleinere Presentational Components zerlegt (`MetricCard`, `InfoCard`, `StatusList`), ohne die UI-Datenquelle oder das Styling fachlich zu verändern.

## 2. Qualitätslage nach der Bestandsaufnahme

### Sauber / belastbar

- TypeScript-Projektreferenzen und Node-Test-Suites laufen über den Root-Check.
- API, Store und Domain Model haben einen gemeinsamen Crawl-Kontrakt für Crawl Runs, Discovery, Fetches, Indexability, Audit Issues und Health Scores.
- Die neue Modulgrenze reduziert das Risiko, dass weitere Sprints `app.ts` und `sqlite-store.ts` noch größer und schwerer testbar machen.

### Weiterhin technische Schulden

- `sqlite-store.ts` ist trotz ausgelagerter Mapper noch SQL- und Use-Case-lastig. Die nächste sinnvolle Zerlegung ist pro Aggregate/Repository: Auth, Project/Site, Crawl Artifacts, Jobs/Integrations.
- API-Routing nutzt noch manuelles Regex-Matching. Das ist für den aktuellen Umfang akzeptabel, sollte aber bei weiteren Endpoint-Gruppen in deklarative Route-Tabellen oder einen kleinen Router überführt werden.
- Request-Validierung ist bewusst leichtgewichtig, aber nicht schema-getrieben. Bei wachsendem OpenAPI-Umfang sollten Validatoren aus gemeinsamen Schemas/Contracts abgeleitet oder zentral getestet werden.
- Web-App zeigt weiterhin Demo-/Fixture-Daten und ist noch nicht an echte API-Zustände angebunden.
- Security-, Session-, Connector- und Crawl-Worker-Aspekte sind noch Foundation-Level und nicht production-grade.

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

### Sprint B — UI an echte Foundation-/Crawl-Daten anbinden

Ziel: Demo-Konsole in eine echte operative Oberfläche überführen.

1. API-Client-Schicht für Foundation- und Crawl-Endpunkte anlegen.
2. Dashboard Cards mit echten `/projects`, `/sites`, `/crawl-runs`, `/health-scores` Daten versorgen.
3. Lade-, Fehler- und Empty-States pro Modulkomponente ergänzen.
4. Komponenten weiter presentational halten; Datenzugriff in Route-/Container-Schichten kapseln.

### Sprint C — Crawl Worker als ausführbarer Prozess

Ziel: Crawler-Service von Library-Utilities zu einem wiederholbaren Worker-Slice ausbauen.

1. Job-Consumer für `crawl_seed` implementieren.
2. Sitemap/Seed Discovery gegen API/Store persistieren.
3. Fetch/Indexability/Issue-Pipeline mit Run-Summary verbinden.
4. Idempotenz- und Retry-Regeln in Tests absichern.

## 4. Do-not-break-Hinweise

- Domain-Model-Typen sind aktuell die zentrale Vertragsquelle zwischen API, Store, Crawler und UI. Änderungen zuerst dort und in OpenAPI/Docs nachvollziehen.
- SQLite-Schema-Änderungen nur mit Migrationsstrategie dokumentieren; keine stillen Spalten-/Constraint-Änderungen ohne Tests.
- Bestehende API-Pfade aus `DOCS/openapi/internal-api.yaml` nicht umbenennen, solange UI/Worker noch darauf aufbauen.
- Demo-Fixtures nicht als Produktlogik behandeln; echte Datenintegration getrennt einführen.

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
