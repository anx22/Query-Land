# Monorepo Conventions

> Scope: Applies to all implementation waves. Master spec remains the source of truth.

## Workspace map

| Path | Responsibility | May import from |
|---|---|---|
| `apps/web` | Next.js UI, routes, screens, UI smoke states | `packages/*` |
| `apps/api` | HTTP routing, DTO validation, API services, embedded backend adapters | `packages/*` |
| `services/*` | Background workers and data-processing jobs | `packages/*` |
| `packages/domain-model` | Shared domain types, pure validators, scoring helpers | no apps/services |
| `packages/shared-config` | Runtime config and stack decisions | no apps/services |
| `infra/*` | SQL, Docker, migrations, fixtures | n/a |
| `DOCS/*` | Source-of-truth docs, specs, task backlogs | n/a |

## Import direction

- Apps and services may import packages.
- Packages must not import apps or services.
- Services must not import app internals; shared worker contracts belong in `packages/domain-model`.
- API route DTOs may live in `apps/api`; cross-service domain contracts belong in `packages/domain-model`.

## Tests and fixtures

- Package tests live next to packages under `packages/<name>/test`.
- API tests live under `apps/api/test` and should use `sqlite::memory:` unless a migration test explicitly needs a file DB.
- Fixtures that are product examples live in `infra/fixtures`; test-only fixtures stay near the test.
- Build outputs (`dist`, `.next`, `data`) remain ignored.

## Database and migrations

- Local/Codex execution uses SQLite by default.
- Production/scale-out target remains Postgres.
- Add schema changes to both `infra/db/sqlite` and `infra/db/init` or document why the change is local-only.

## Required checks before a sprint PR

1. `npm run typecheck`
2. `npm run check:boundaries`
3. `npm run validate:openapi`
4. `npm test`

## Web module boundaries

- Feature routes are registered centrally in `apps/web/src/app/module-routes.ts` with path, label, status and planned wave.
- New module-specific UI, data loading, hooks and workflow state belong under `apps/web/src/features/<module>`.
- `apps/web/src/components/module-page.tsx` and shared route factories must stay generic shells; do not grow future module logic inside `ModulePage` or other generic page wrappers.
