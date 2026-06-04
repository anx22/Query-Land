import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { apiDefaults } from "@seo-tool/shared-config";
import { runSQLiteMigrations } from "./sqlite-migrations.js";
import { sqliteLocation } from "./sqlite-store.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (location: string) => { exec(sql: string): void; prepare(sql: string): { run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }; get(...params: unknown[]): Record<string, unknown> | undefined; all(...params: unknown[]): Array<Record<string, unknown>> }; close(): void };
};

const databaseUrl = process.argv[2] ?? process.env.SEO_DATABASE_URL ?? apiDefaults.databaseUrl;
const location = sqliteLocation(databaseUrl);
if (location !== ":memory:") {
  mkdirSync(dirname(location), { recursive: true });
}

const db = new DatabaseSync(location);
try {
  const result = runSQLiteMigrations(db);
  console.log(JSON.stringify({
    database: location,
    migrationsDir: result.migrationsDir,
    applied: result.applied.map((migration) => migration.filename),
    skipped: result.skipped.map((migration) => migration.filename)
  }, null, 2));
} finally {
  db.close();
}
