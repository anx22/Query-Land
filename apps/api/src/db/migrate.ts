/**
 * Async, Postgres migration runner.
 *
 * Replaces the synchronous SQLite runner. Reads versioned `.sql` files from the
 * Postgres migrations directory and applies the unapplied ones in order,
 * tracking them in `schema_migrations`. Each file runs via `db.exec`, which on
 * Postgres executes the file's statements in a single implicit transaction.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AsyncDatabase } from "./types.js";

export interface Migration {
  version: number;
  name: string;
  filename: string;
  sql: string;
}

export interface MigrationResult {
  migrationsDir: string;
  applied: Migration[];
  skipped: Migration[];
}

const migrationFilePattern = /^(\d+)_(.+)\.sql$/;

export async function runMigrations(
  db: AsyncDatabase,
  migrationsDir = resolveMigrationsDir()
): Promise<MigrationResult> {
  await db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`);

  const migrations = loadMigrations(migrationsDir);
  const appliedRows = await db.prepare(`SELECT version FROM schema_migrations`).all();
  const appliedVersions = new Set(appliedRows.map((row) => Number(row.version)));

  const applied: Migration[] = [];
  const skipped: Migration[] = [];

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      skipped.push(migration);
      continue;
    }
    await db.exec(migration.sql);
    await db
      .prepare(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
      .run(migration.version, migration.name, new Date().toISOString());
    applied.push(migration);
  }

  return { migrationsDir, applied, skipped };
}

export function loadMigrations(migrationsDir = resolveMigrationsDir()): Migration[] {
  if (!existsSync(migrationsDir)) {
    throw new Error(`Postgres migrations directory not found: ${migrationsDir}`);
  }

  const migrations = readdirSync(migrationsDir)
    .flatMap((filename): Migration[] => {
      const match = migrationFilePattern.exec(filename);
      if (!match) return [];
      return [
        {
          version: Number(match[1]),
          name: match[2] ?? "migration",
          filename,
          sql: readFileSync(join(migrationsDir, filename), "utf8")
        }
      ];
    })
    .sort((left, right) => left.version - right.version);

  const seen = new Set<number>();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }
    seen.add(migration.version);
  }

  if (migrations.length === 0) {
    throw new Error(`No migrations found in ${migrationsDir}`);
  }

  return migrations;
}

export function resolveMigrationsDir(): string {
  const explicit = process.env.SEO_PG_MIGRATIONS_DIR;
  if (explicit) return resolve(explicit);

  const candidates = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of candidates) {
    const found = findUp(start, "infra/db/postgres");
    if (found) return found;
  }

  return resolve(process.cwd(), "infra/db/postgres");
}

function findUp(start: string, relativePath: string): string | null {
  let current = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(current, relativePath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}
