import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SQLiteMigrationDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Array<Record<string, unknown>>;
  };
}

export interface SQLiteMigration {
  version: number;
  name: string;
  filename: string;
  sql: string;
}

export interface SQLiteMigrationResult {
  migrationsDir: string;
  applied: SQLiteMigration[];
  skipped: SQLiteMigration[];
}

const migrationFilePattern = /^(\d+)_(.+)\.sql$/;

export function runSQLiteMigrations(db: SQLiteMigrationDatabase, migrationsDir = resolveSQLiteMigrationsDir()): SQLiteMigrationResult {
  db.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`);

  const migrations = loadSQLiteMigrations(migrationsDir);
  const appliedVersions = new Set(
    db.prepare(`SELECT version FROM schema_migrations`).all().map((row) => Number(row.version))
  );
  const applied: SQLiteMigration[] = [];
  const skipped: SQLiteMigration[] = [];

  db.exec("BEGIN");
  try {
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        skipped.push(migration);
        continue;
      }
      db.exec(migration.sql);
      db.prepare(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
        .run(migration.version, migration.name, new Date().toISOString());
      applied.push(migration);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { migrationsDir, applied, skipped };
}

export function loadSQLiteMigrations(migrationsDir = resolveSQLiteMigrationsDir()): SQLiteMigration[] {
  if (!existsSync(migrationsDir)) {
    throw new Error(`SQLite migrations directory not found: ${migrationsDir}`);
  }

  const migrations = readdirSync(migrationsDir)
    .flatMap((filename): SQLiteMigration[] => {
      const match = migrationFilePattern.exec(filename);
      if (!match) return [];
      return [{
        version: Number(match[1]),
        name: match[2] ?? "migration",
        filename,
        sql: readFileSync(join(migrationsDir, filename), "utf8")
      }];
    })
    .sort((left, right) => left.version - right.version);

  const seen = new Set<number>();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate SQLite migration version: ${migration.version}`);
    }
    seen.add(migration.version);
  }

  if (migrations.length === 0) {
    throw new Error(`No SQLite migrations found in ${migrationsDir}`);
  }

  return migrations;
}

export function resolveSQLiteMigrationsDir(): string {
  const explicit = process.env.SEO_SQLITE_MIGRATIONS_DIR;
  if (explicit) return resolve(explicit);

  const candidates = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of candidates) {
    const found = findUp(start, "infra/db/sqlite");
    if (found) return found;
  }

  return resolve(process.cwd(), "infra/db/sqlite");
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
