# Internal SEO OS — Produktkompendium

Source of Truth für die Nachbauprogrammierung. Einstieg: `docs/PRODUCT_MASTER_SPEC.md`.

## Struktur

```
docs/    PRODUCT_MASTER_SPEC.md   ← oberste Wahrheitsebene (inkl. KPIs, Referenz-Anker, UX-Navigation)
         MONOREPO_CONVENTIONS.md  ← Workspace-Regeln, Import/Export, Pre-Sprint-Checks
         MIGRATION_STRATEGY.md    ← SQLite→Postgres-Policy
specs/   14 Child-Specs           ← verfeinern Module/Querschichten; Master gewinnt bei Konflikt
prompts/ codex-prompts.md         ← Basis-Prompt-Muster + Wellen-Übersicht (Wellen 1–7)
openapi/ internal-api.yaml        ← API-Vertrag; UI + Agent/MCP teilen den Kern
design/  DESIGN.md                ← Brand-System (Farben, Typo, Layout)
         ux-ui-sprint.md          ← UX-Sprint-Spec (UX-0–UX-9, DoD, Komponenten)
tasks/   roadmap.md               ← Phase-2-Roadmap (aktiv)
         next-session-handoff.md  ← aktueller Sprint-Status + Empfehlungen
         decisions-backlog.md     ← DEC-001–007 Produktentscheidungen
         welle-1-rest-stories.md  ← Welle-1-Reststories (aktiv)
         welle-2-audit-core-stories.md ← Welle-2-Story-Seeds (aktiv)
         sprint-conventions.md    ← Story-Template + Testing-Matrix
         preparation-hardening-backlog.md ← Härtungs-Checkliste (Phase 1, alle erledigt)
         worker-smoke.md          ← WP-0.3 Smoke-Anleitung
         _archive/                ← Phase-1-Abschluss, Persistenz-Skizze
deployment/ vercel-single-deployment.md ← Vercel-Konfiguration
_Konzepte/  einschetzung.txt      ← strategischer Nord-Stern
            LLM_council_analyse.txt ← Entscheidungs-Druck-Test (16→7 Module)
```

## Lesereihenfolge für Implementierung

Master §1 → §2 → §6 → §7 → §10 → zuständige Child-Spec → Codex-Prompt für die Welle.

## Aktueller Stand

Phase 2 aktiv. Sprint-Status: `tasks/next-session-handoff.md`. Roadmap: `tasks/roadmap.md`.
