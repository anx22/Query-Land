# Internal SEO OS — Produktkompendium

Source of Truth für die Nachbauprogrammierung. Einstieg: `docs/PRODUCT_MASTER_SPEC.md`.

## Struktur

```
docs/    PRODUCT_MASTER_SPEC.md   ← oberste Wahrheitsebene (KPIs, Referenz-Anker, UX-Navigation)
         MONOREPO_CONVENTIONS.md  ← Workspace-Regeln, Import/Export, Pre-Sprint-Checks
         MIGRATION_STRATEGY.md    ← (historisch) SQLite→Postgres; Migration abgeschlossen
specs/   14 Child-Specs           ← verfeinern Module/Querschichten; Master gewinnt bei Konflikt
architecture/ ai-layer-aeo · authority-backlinks · reporting-alerts ← tiefe, implementierte Modul-Docs
prompts/ codex-prompts.md         ← Basis-Prompt-Muster + Wellen-Übersicht
openapi/ internal-api.yaml        ← API-Vertrag (~66 Pfade); UI + Agent/MCP teilen den Kern
design/  brand-identity.md        ← ★ einzige Brand-&-Design-Quelle (Marke, Farbe, Typo, „New Horizon", Komponenten, Roadmap). Token-Quelle: apps/web/src/app/globals.css
         ux-ui-sprint.md          ← UX-Sprint-Spec (UX-0–UX-9, DoD, Komponenten)
tasks/   roadmap.md               ← ★ aktive, konsolidierte Planungsquelle (Status + GAPs)
         parallel-execution-plan.md ← ★ paralleler Umsetzungsplan der offenen Punkte
         decisions-backlog.md     ← DEC-001–007 Produktentscheidungen
         sprint-conventions.md    ← Story-Template + Testing-Matrix
         worker-smoke.md          ← Crawl-Worker-Smoke-Anleitung
         _archive/                ← Historie: Phase-1-Abschluss, Handoff, Welle-Stories, Prep-Backlog
deployment/ serverless-crawl-worker.md ← ★ Cron-Worker (/api/cron/crawl, CRON_SECRET)
            vercel-database-switch.md   ← DATABASE_URL umstellen (neondb → queryland)
            vercel-single-deployment.md ← Vercel-Projekt-/Build-Konfiguration
_Konzepte/  einschetzung.txt      ← strategischer Nord-Stern (16→7-Module-Ära)
            LLM_council_analyse.txt ← Entscheidungs-Druck-Test (16→7 Module)
```

## Lesereihenfolge für Implementierung

Master §1 → §2 → §6 → §7 → §10 → zuständige `architecture/`- oder Child-Spec → `tasks/roadmap.md` + `tasks/parallel-execution-plan.md`.

## Aktueller Stand

Phase 2 aktiv. **Planung & Status:** `tasks/roadmap.md`. **Parallele Umsetzung:** `tasks/parallel-execution-plan.md`.
Fundament (Neon Postgres, Serverless-Cron-Worker, Connector-Sync) steht und ist in Production verifiziert.
