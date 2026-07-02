# Improve-Pläne — Index

> Erzeugt von `/improve` gegen Commit **`ac6a800`** (Branch `main`).
> Jeder Plan ist eigenständig und für einen Executor mit **null Kontext aus der Analyse-Session**
> geschrieben. `/improve` selbst ändert keinen Produktivcode — diese Dateien sind die Arbeitsvorlage.

## Herkunft

Vier parallele Audit-Agenten (Backend, Frontend, Security, Tests/Debt/Deps/DX/Docs/Direction) haben die
Codebase geprüft; alle Befunde wurden anschließend von Hand im Code gegengeprüft (mehrere Subagenten-
Befunde verworfen bzw. runtergestuft — siehe „Betrachtet & verworfen" unten). Auswahl: **alle Top-8**
plus zwei Direction-Items (Linkgraph, Empty≠Error).

## Status-Tabelle

| Plan | Titel | Kat. | Aufwand | Hängt ab von | Status |
|------|-------|------|---------|--------------|--------|
| [001](001-env-example-pglite.md) | `.env.example` auf `pglite:` korrigieren | DX | S | — | ✅ DONE (Branch `improve/plans-001-003`) |
| [002](002-ci-workflow-claude-md.md) | CI-Workflow + `CLAUDE.md` | DX | S–M | — | ✅ DONE (grüner CI-Lauf erst nach Push/PR) |
| [003](003-http-security-headers.md) | HTTP-Security-Header | Security | S | — | ✅ DONE (Web-Build grün; CSP im Browser noch sichtprüfen) |
| [004](004-integrations-ownership.md) | `/integrations` Ownership-Härtung | Security | S–M | — | ✅ DONE (Guards waren schon da; nur Doku-Kommentare) |
| [005](005-recordauditissues-n1.md) | `recordAuditIssues` N+1-Roundtrips reduzieren | Perf/Korrekt. | S–M | — | ✅ DONE (207 api+crawler Tests grün) |
| [006](006-mcp-tools-efficiency.md) | MCP `buildProjectSummary` + `resolveDiscoveredUrl` | Perf | M | — | ✅ DONE (164 mcp+api Tests grün) |
| [007](007-route-handler-tests.md) | Tests für Next.js Route-Handler | Test | M | 002, 004 | ✅ DONE (10 Web-Tests grün: oauth/cron/export) |
| [008](008-eslint-prettier.md) | ESLint + Prettier (separat, später) | DX | M | 002 | ✅ DONE (npm run lint exit 0, 54 warns; CI non-blocking) |
| [009](009-linkgraph-edges.md) | Interner Linkgraph: Edges befüllen (GAP-LINK-001) | Direction | L | — | ✅ DONE (58 crawler Tests grün; anchor+rel end-to-end) |
| [010](010-empty-not-error.md) | „Empty≠Error"-Muster ausrollen | Direction | M | — | ⏭️ VERIFIZIERT-ÜBERSPRUNGEN (alle 4 Module schon ehrlich; s. Notiz) |

## Empfohlene Reihenfolge

Isolierte Pläne **001–006, 009, 010** sind parallelisierbar. **007** nach 004 (Tests sollen das neue
Scoping abbilden) und nach 002 (CI führt sie aus). **008** nach 002. 005/006 sind durch bestehende
Tests abgesichert. Schneller Start-Trio ohne Abhängigkeiten und mit sauberer Verifikation: **001 → 003 → 002**.

## Notiz zu Plan 010 (bei Umsetzung verifiziert-übersprungen)

Beim Umsetzen wurde jede der vier Modul-Seiten gelesen — **alle implementieren „Empty≠Error" bereits
ehrlich**, nur via Inline-Notices/Two-Mode statt der `ModulesPending`-Komponente:
- `backlinks/page.tsx`: `OfflineNotice` (Provider nicht verbunden) **+** „Backlink-Anbindung folgt"-Notice
  (verbunden, keine Quelle) + `hasData`-Guard gegen Fake-„0 %".
- `ai-visibility/page.tsx`: „Noch kein KI-Anbieter verbunden … kein Messergebnis" + Class-E + `hasAiScore`-Guard.
- `keywords-rank/page.tsx`: Two-Mode (`hasKeywords`) führt mit „Keywords hinzufügen"-Formular; `hasVisibility`-Guard.
- `reports/page.tsx`: Two-Mode (`hasReportingData`) versteckt die KPI-Grid; Create-Form + per-Sektion-Leerzustände.

Der einzige Delta zur Referenz (Technical Audit/Dashboard nutzen `ModulesPending`) ist **stilistisch**. Ein
mechanischer Rollout würde **backlinks verschlechtern** (dessen Leerzustand hat bewusst *keinen* CTA, weil der
Nutzer nichts tun kann) und ist reine Optik-Churn ohne visuelle Verifikation. Daher übersprungen. Falls eine
komponenten-einheitliche Optik gewünscht ist, wäre das ein separater, visuell zu verifizierender Design-Task.

## Betrachtet & verworfen (nicht als Plan umgesetzt)

- **`hashToken` statischer Salt** ([apps/api/src/password.ts:22](../apps/api/src/password.ts)) —
  für hochentropische Session-Tokens vertretbar; der „Kollisions"-Frame war unbegründet. Höchstens
  scrypt→HMAC aus Perf-Gründen; nicht dringend.
- **Cookie `secure` nur in prod** ([apps/web/src/app/login/actions.ts:34](../apps/web/src/app/login/actions.ts)) —
  Standard/by-design für localhost-HTTP; `httpOnly`+`sameSite` korrekt.
- **IssueDetailDrawer `catch → []`** ([apps/web/src/features/technical-audit/issue-groups.tsx:115](../apps/web/src/features/technical-audit/issue-groups.tsx)) —
  das `cancelled`-Muster ist korrekt; nur Ladefehler nicht von „leer" unterscheidbar (winzig).
- **Diverse Frontend-Perf-Nits** (Filter-Fetch nicht parallel, Client-Filtering, useMemo-Rerenders) —
  verfrüht beim aktuellen Datenvolumen.
- **Frontend „stale closure / StrictMode"**, **keywords-rank Non-Null-Assertion**, **link-graph
  Error-Propagation**, **issueId-Lookup**, **gsc-credentials „Credential-Logging"** — beim Nachlesen
  keine echten Bugs (Muster korrekt / Agent-Selbstverwurf / spekulativ).
- **postcss-XSS** (GAP-SEC-001) und **Multi-Tenancy** (DEC-008) — bereits dokumentiert getrackt.
