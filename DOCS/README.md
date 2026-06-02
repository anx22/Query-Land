# Internal SEO OS — Produktkompendium

Source of Truth für die Nachbauprogrammierung. Einstieg: `docs/PRODUCT_MASTER_SPEC.md`.

```
docs/    PRODUCT_MASTER_SPEC.md (oberste Wahrheitsebene) + REFERENCE_ANCHORS, KPI_DEFINITIONS, UX_FLOWS
specs/   14 Child-Specs (verfeinern Module/Querschichten; Master gewinnt bei Konflikt)
prompts/ 7 Codex-Welle-Prompts (Muster Master §12.3)
openapi/ internal-api.yaml (Gerüst; UI + Agent/MCP teilen den Kern)
```

Reihenfolge: Master §1→§2→§6→§7→§10 → zuständige Child-Spec. Gebaut wird in Wellen (§10), vertikal geschnitten (§12.2), validiert gegen den Master.
