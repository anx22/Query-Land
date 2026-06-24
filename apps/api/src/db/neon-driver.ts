/**
 * Neon serverless driver — production Postgres.
 *
 * Single statements run over the pool (HTTP-accelerated); transactions check
 * out a dedicated pooled client and run real BEGIN/COMMIT so the store
 * transaction blocks keep their semantics. Loaded lazily.
 */
import { neonConfig, Pool, types } from "@neondatabase/serverless";
import { toPgPlaceholders } from "./sql-translate.js";
import type { AsyncDatabase, SqlExecutor, SqlRow, SqlStatement } from "./types.js";

// Match the previous SQLite numeric behaviour: int8/numeric → JS number.
types.setTypeParser(20, (value: string) => Number(value)); // int8 (COUNT(*), etc.)
types.setTypeParser(1700, (value: string) => Number(value)); // numeric

// Node 22 ships a global WebSocket; use it so no `ws` dependency is required.
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}
// Route single (non-transaction) pool queries over low-latency HTTP.
neonConfig.poolQueryViaFetch = true;

interface PgQuerier {
  query(text: string, params?: unknown[]): Promise<{ rows: SqlRow[]; rowCount: number | null }>;
}

function executor(querier: PgQuerier): SqlExecutor {
  return {
    prepare(sql: string): SqlStatement {
      const text = toPgPlaceholders(sql);
      return {
        async run(...params: unknown[]) {
          const result = await querier.query(text, params);
          return { changes: result.rowCount ?? 0 };
        },
        async get(...params: unknown[]) {
          const result = await querier.query(text, params);
          return result.rows[0];
        },
        async all(...params: unknown[]) {
          const result = await querier.query(text, params);
          return result.rows;
        }
      };
    }
  };
}

export async function createNeonDatabase(connectionString: string): Promise<AsyncDatabase> {
  const pool = new Pool({ connectionString });
  const base = executor(pool);
  return {
    prepare: base.prepare,
    async exec(sql: string) {
      const client = await pool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
    },
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(executor(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore rollback failures; surface the original error
        }
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}
