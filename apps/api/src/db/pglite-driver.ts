/**
 * PGlite driver — embedded Postgres (WASM) for local development and tests.
 *
 * Same Postgres dialect as production Neon; only the connection differs. Loaded
 * lazily so the WASM bundle never ships to the production (Neon) serverless
 * function.
 */
import { toPgPlaceholders } from "./sql-translate.js";
import type { AsyncDatabase, SqlExecutor, SqlRow, SqlStatement } from "./types.js";

// int8 + numeric come back as strings by default (e.g. COUNT(*)); coerce to
// number to match the previous SQLite behaviour the stores were written for.
const INT_PARSERS = {
  20: (value: string) => Number(value), // int8
  1700: (value: string) => Number(value) // numeric
};

interface PgliteQuerier {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
}

function executor(querier: PgliteQuerier): SqlExecutor {
  return {
    prepare(sql: string): SqlStatement {
      const text = toPgPlaceholders(sql);
      return {
        async run(...params: unknown[]) {
          const result = await querier.query<SqlRow>(text, params);
          return { changes: result.affectedRows ?? 0 };
        },
        async get(...params: unknown[]) {
          const result = await querier.query<SqlRow>(text, params);
          return result.rows[0];
        },
        async all(...params: unknown[]) {
          const result = await querier.query<SqlRow>(text, params);
          return result.rows;
        }
      };
    }
  };
}

export async function createPgliteDatabase(location: string): Promise<AsyncDatabase> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db =
    location === ":memory:"
      ? new PGlite({ parsers: INT_PARSERS })
      : new PGlite({ dataDir: location, parsers: INT_PARSERS });
  await db.waitReady;

  const base = executor(db);
  return {
    prepare: base.prepare,
    async exec(sql: string) {
      await db.exec(sql);
    },
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => fn(executor(tx)));
    },
    async close() {
      await db.close();
    }
  };
}
