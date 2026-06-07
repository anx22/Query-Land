# Codex-Prompts — Wellen 1–7

> Muster aus Master §12.3. Vor Nutzung: zuständige `specs/*.md` lesen.
> Alle Wellen teilen dasselbe Basis-Prompt-Muster; nur Scope und Spec-Referenz unterscheiden sich.

## Basis-Muster (gilt für jede Welle)

```
Nutze `docs/PRODUCT_MASTER_SPEC.md` als Wahrheitsebene und die zugehörige(n) `specs/<spec>.md` als Detailebene.
Implementiere NUR den Scope dieser Welle (siehe Master §10, Tabelle).
- Lege alle Annahmen offen.
- Schreibe Tests zuerst.
- Verändere keine API-Verträge außerhalb des Scopes.
- Erzeuge DB-Schema/Migrationen, API-Routen, Services/Pipelines, UI-States, Beispiel-Fixtures.
- Dokumentiere Failure Modes und Migrationsschritte.

Akzeptanzkriterien (Master §12.4): keine Empfehlung ohne Evidenz · keine Provider-Hardcodierung · Raw/Normalized getrennt · Jobs idempotent · Fehler sichtbar · Tests für Kernlogik · Schreibaktionen reviewpflichtig.

Go/No-Go-Gate dieser Welle: siehe Master §10.
```

## Wellen-Übersicht

| Welle | Name | Primäre Specs | Status |
|-------|------|---------------|--------|
| 1 | Foundation | `specs/project-control.md`, `specs/integrations.md`, `specs/observability-sre.md`, `specs/security-privacy.md` | ✅ abgeschlossen |
| 2 | Crawl Core | `specs/crawl-engine.md`, `specs/issue-rules.md` | Welle-2-Contract done, Worker/UI in Arbeit |
| 3 | Keyword Core | `specs/keyword-intelligence.md`, `specs/rank-tracking.md`, `specs/visibility-index.md` | Welle-3-Planung |
| 4 | Opportunity Engine | `specs/content-opportunities.md`, `specs/source-map.md` | Welle-4-Planung |
| 5 | Authority Layer | `specs/backlink-intelligence.md` | Welle-5-Planung |
| 6 | Reporting Layer | `specs/reporting-alerting.md` | Welle-6-Planung |
| 7 | AI Layer | `specs/ai-visibility.md` | Welle-7-Planung |

## Welle 1 — Foundation

Scope: Monorepo, Auth/Rollen, Projekte, Ingestion-Gerüst, Datenmodell, Job-System, Observability, Source-Map-Grundgerüst.
Gate: Domain anlegen, Crawl starten, GSC/GA4 verbinden.

## Welle 2 — Crawl Core

Scope: Crawler, URL-Discovery, Issue-Engine, Health Score, interner Linkgraph, Indexierbarkeits-Pipeline, Web-Vitals.
Gate: 95 % stabile Vollcrawls auf eigenen Sites.

## Welle 3 — Keyword Core

Scope: Keyword-Bibliothek, Rank-Tracking definierter Sets, Visibility-Index, SERP-Snapshots/-Diffs.
Gate: Tägliche Verläufe, Export, Alerts.

## Welle 4 — Opportunity Engine

Scope: Search-Performance-Intelligence, fünf Opportunity-Klassen, Prioritätsscore, Evidenz, Validierungsloop, Source-Anchoring.
Gate: Jede Empfehlung mit Evidenz + Score + Validierungsmetrik; erster Generator (§6.6) validiert real.

## Welle 5 — Authority Layer

Scope: GSC-Link-Import, Ref-Domain-Modell, New/Lost, Broken Targets, Authority-Gaps.
Gate: Neue/verlorene Links nachvollziehbar.

## Welle 6 — Reporting Layer

Scope: Dashboards, PDF/CSV, E-Mail/Slack, Executive Reports, Alerts.
Gate: Wochenreport automatisiert.

## Welle 7 — AI Layer

Scope: AI Visibility, Prompt/Citation/Mention/Referral-Tracking, AEO, MCP-Vollausbau.
Gate: Agent beantwortet echte SEO-Fragen über eigene Daten.
