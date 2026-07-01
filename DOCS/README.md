# Dokumentation

Bewusst schlank: die Doku **umreißt** — was das Produkt ist, wie es steht, warum es so gebaut ist und wie
man es betreibt. Sie doppelt nicht den Code; Details leben im Code und im API-Vertrag.

## Orientierung
- [`PRODUCT_MASTER_SPEC.md`](./PRODUCT_MASTER_SPEC.md) — **was das Produkt ist** (Mission, 7 Module,
  Opportunity-Schleife, Datenmodell, Wellen). Wahrheitsebene fürs Produkt.
- [`ROADMAP.md`](./ROADMAP.md) — **Stand & Nächstes** (was steht, was fehlt zum Scharfschalten, GAPs).
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — **die tragenden Nahtstellen & Erkenntnisse** (Confidence-Firewall,
  Stub→Real-Connectors, Opportunity-Loop, Known Pitfalls).
- [`DECISIONS.md`](./DECISIONS.md) — die großen strategischen Entscheidungen (DEC-*).

## Arbeiten & Betreiben
- [`MONOREPO_CONVENTIONS.md`](./MONOREPO_CONVENTIONS.md) — Workspace-Grenzen, Import-Regeln, Checks.
- [`deployment/`](./deployment/) — Vercel-Setup, Cron-Crawl-Worker, Google-OAuth (GSC).
- [`openapi/internal-api.yaml`](./openapi/internal-api.yaml) — API-Vertrag (UI + Agent/MCP teilen den Kern).

## Marke & Design
- [`design/brand-identity.md`](./design/brand-identity.md) — die einzige Brand-&-Design-Quelle.
  Kanonische Tokens: `apps/web/src/app/globals.css`. Assets: [`../brand/README.md`](../brand/README.md).

> Bei Konflikt gewinnt der Master-Spec fürs Produkt und `globals.css` für Design-Tokens.
