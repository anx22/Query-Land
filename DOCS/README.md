# Internal SEO OS — Produktkompendium

Source of Truth für die Nachbauprogrammierung. Einstieg: `docs/PRODUCT_MASTER_SPEC.md`.

```
docs/    PRODUCT_MASTER_SPEC.md (oberste Wahrheitsebene) + REFERENCE_ANCHORS, KPI_DEFINITIONS, UX_FLOWS
specs/   14 Child-Specs (verfeinern Module/Querschichten; Master gewinnt bei Konflikt)
prompts/ 7 Codex-Welle-Prompts (Muster Master §12.3)
openapi/ internal-api.yaml (Gerüst; UI + Agent/MCP teilen den Kern)
tasks/   Vorbereitungshärtung, Story-/Sprint-Backlog und offene Entscheidungen
```

Reihenfolge: Master §1→§2→§6→§7→§10 → zuständige Child-Spec. Gebaut wird in Wellen (§10), vertikal geschnitten (§12.2), validiert gegen den Master.


Aktueller Preparation-Backlog: `tasks/preparation-hardening-backlog.md`.


Vor Sprintstart abgeschlossen:
- Monorepo-Konventionen: `docs/MONOREPO_CONVENTIONS.md`
- SQLite/Postgres-Migration: `docs/MIGRATION_STRATEGY.md`
- Preparation-Backlog: `tasks/preparation-hardening-backlog.md`
- Story-Template: `tasks/story-template.md`
- Testing-Matrix: `tasks/testing-matrix.md`
- Decisions-Backlog: `tasks/decisions-backlog.md`
- Welle-1 Reststories: `tasks/welle-1-rest-stories.md`
- Welle-2 Audit-Core Story Seeds: `tasks/welle-2-audit-core-stories.md`
- Roadmap-/Status-Tracking: `tasks/roadmap-tracking.md`
