# SEO-tool

Ein internes SEO Operating System für eigene Webplattformen, das technische Qualität, organische Sichtbarkeit, Content-Potenziale, Link-Autorität und AI-Visibility in einem entscheidungsfähigen Workflow vereint — und Erkenntnisse nicht nur misst, sondern bis in den eigenen Quellcode hinein in umsetzbare, validierbare Arbeit übersetzt.

## App Foundation

Der erste vertikale Schnitt folgt Welle 1 aus `DOCS/docs/PRODUCT_MASTER_SPEC.md`: Monorepo, Projekt-Kontext, Connector-Gerüst, Job-Monitoring, Source-Map-Grundgerüst und UI-Routing aus `DOCS/docs/UX_FLOWS.md`.

### Struktur

- `apps/web` — Next.js App Router Oberfläche mit der Hauptnavigation Overview, Projects, Technical Audit, Keywords & Rank, Content & Opportunities, Backlinks, Reports, AI Visibility und Settings.
- `apps/api` — schlankes TypeScript-API-Gerüst für gemeinsam nutzbaren Foundation-State.
- `packages/domain-model` — bindende Domain-Typen für Project, Integration, Jobs, Source Map, Evidence und Opportunity.
- `packages/shared-config` — Routing-Registry, SEO-Memory-Snapshot und Demo-Fixtures für den Welle-1-Schnitt.
- `infra/docker-compose.yml` — lokales Postgres-System-of-Record gemäß Master-Spec.

### Befehle

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
```
