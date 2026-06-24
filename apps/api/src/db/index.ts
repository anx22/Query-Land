/**
 * Database factory — picks a driver from the DATABASE_URL.
 *
 *   postgres:// | postgresql://   → Neon serverless (production)
 *   sqlite::memory: | :memory:    → PGlite in-memory (tests)
 *   pglite:<path> | sqlite:<path> → PGlite file (local dev)
 *
 * The legacy `sqlite:` prefixes are accepted so existing scripts/tests that set
 * `DATABASE_URL=sqlite::memory:` keep working against the Postgres-dialect PGlite.
 */
import type { AsyncDatabase } from "./types.js";
import { createNeonDatabase } from "./neon-driver.js";
import { createPgliteDatabase } from "./pglite-driver.js";

export * from "./types.js";

export type ResolvedDatabase =
  | { kind: "postgres"; url: string }
  | { kind: "pglite"; location: string };

export function resolveDatabaseTarget(databaseUrl: string): ResolvedDatabase {
  if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    return { kind: "postgres", url: databaseUrl };
  }
  if (
    databaseUrl === "sqlite::memory:" ||
    databaseUrl === ":memory:" ||
    databaseUrl === "memory" ||
    databaseUrl === "pglite::memory:"
  ) {
    return { kind: "pglite", location: ":memory:" };
  }
  if (databaseUrl.startsWith("pglite:")) {
    return { kind: "pglite", location: databaseUrl.slice("pglite:".length) };
  }
  if (databaseUrl.startsWith("sqlite:")) {
    return { kind: "pglite", location: databaseUrl.slice("sqlite:".length) };
  }
  return { kind: "pglite", location: databaseUrl };
}

export async function createDatabase(databaseUrl: string): Promise<AsyncDatabase> {
  const target = resolveDatabaseTarget(databaseUrl);
  if (target.kind === "postgres") {
    return createNeonDatabase(target.url);
  }
  return createPgliteDatabase(target.location);
}
