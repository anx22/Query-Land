/**
 * Async database abstraction shared by every store.
 *
 * Mirrors the old synchronous `node:sqlite` shape (`prepare(...).run/get/all`)
 * but each result method is async, because the production driver talks to
 * Postgres (Neon) over the network. Two concrete drivers implement it:
 *   - PGlite (embedded Postgres-in-WASM) for local dev + tests
 *   - Neon serverless (Pool over WebSocket / HTTP) for production
 *
 * Both speak the same Postgres dialect, so "Postgres-only" holds — only the
 * connection differs.
 */
export type SqlRow = Record<string, unknown>;

export interface SqlRunResult {
  /** Number of rows affected (INSERT/UPDATE/DELETE). */
  changes: number;
}

export interface SqlStatement {
  run(...params: unknown[]): Promise<SqlRunResult>;
  get(...params: unknown[]): Promise<SqlRow | undefined>;
  all(...params: unknown[]): Promise<SqlRow[]>;
}

export interface SqlExecutor {
  prepare(sql: string): SqlStatement;
}

export interface AsyncDatabase extends SqlExecutor {
  /** Run one or more raw statements (no params) — used by the migration runner. */
  exec(sql: string): Promise<void>;
  /** Run `fn` inside a single transaction on a dedicated connection. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
