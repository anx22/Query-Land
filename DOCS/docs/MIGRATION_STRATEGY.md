# SQLite ↔ Postgres Migration Strategy

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

## Next migration task

Introduce a migration runner once the first Welle-2 schema change is needed. Until then, Welle-1 schemas remain hand-maintained and validated by tests.
