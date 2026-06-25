# SQLite ↔ Postgres Migration Strategy

> ✅ Abgeschlossen (2026-06): Migration zu Neon Postgres durchgeführt (siehe DOCS/tasks/roadmap.md). Dieses Dokument ist historisch.

## Decision

SQLite is the default local/Codex backend because it is embedded and fully inspectable in this environment. Postgres remains the production and scale-out target from the master spec.

## Rules

- Every persistent entity must have a SQLite representation and a Postgres-compatible representation.
- SQLite migrations live in `infra/db/sqlite`.
- Postgres init/migrations live in `infra/db/init` until a dedicated migration tool is introduced.
- Keep column names semantically identical even where types differ (`TEXT` timestamps in SQLite vs `timestamptz` in Postgres).
- Use application-generated IDs in SQLite and Postgres-compatible IDs in production migrations.

## Known differences

| Concern | SQLite local | Postgres target |
|---|---|---|
| IDs | app-generated `TEXT` IDs | `uuid` or compatible text IDs |
| JSON | serialized `TEXT` | `jsonb` |
| timestamps | ISO `TEXT` | `timestamptz` |
| enums | `CHECK` constraints | enum types or check constraints |
| queue claiming | single-process local claim | transactional claim with row locking |

## Current runner

- SQLite migrations are versioned SQL files in `infra/db/sqlite` and are applied in filename/version order.
- Applied versions are tracked in `schema_migrations` with `version`, `name` and `applied_at`.
- The API store runs pending SQLite migrations before seeding demo Foundation data, so local files and `sqlite::memory:` tests share the same schema path.
- Local smoke command: `npm run migrate:sqlite -- sqlite:./data/seo-tool.db`.

## Next migration task

Add Postgres-compatible migration files for the same entities and introduce a cross-database migration smoke once the Postgres target is available in CI.
