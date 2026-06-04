import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { HealthSnapshot } from "@seo-tool/domain-model";
import { apiDefaults } from "@seo-tool/shared-config";
import { createAuditLog } from "./stores/audit-log.js";
import { createAuthStore, type AuthStore } from "./stores/auth-store.js";
import { createCrawlStore, type CrawlStore } from "./stores/crawl-store.js";
import { createJobStore, type JobStore } from "./stores/job-store.js";
import { createProjectStore, type ProjectStore } from "./stores/project-store.js";
import { createSourceMapStore, type SourceMapStore } from "./stores/source-map-store.js";
import { RequestError } from "./stores/store-errors.js";
import type { SQLiteDatabase } from "./stores/sqlite-types.js";
import { seedFoundation } from "./sqlite-seed.js";
import { runSQLiteMigrations } from "./sqlite-migrations.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (location: string) => SQLiteDatabase;
};

export type HealthStore = {
  health(): HealthSnapshot;
};

export type SQLiteStore = HealthStore & AuthStore & ProjectStore & CrawlStore & JobStore & SourceMapStore & {
  close(): void;
};

export { RequestError };
export type { AuthStore, RegisterInput, LoginResult } from "./stores/auth-store.js";
export type { CrawlStore } from "./stores/crawl-store.js";
export type { JobStore } from "./stores/job-store.js";
export type { ProjectStore } from "./stores/project-store.js";
export type { SourceMapStore } from "./stores/source-map-store.js";

export function createSQLiteStore(databaseUrl = apiDefaults.databaseUrl): SQLiteStore {
  const location = sqliteLocation(databaseUrl);
  if (location !== ":memory:") {
    mkdirSync(dirname(location), { recursive: true });
  }
  const db = new DatabaseSync(location);
  runSQLiteMigrations(db);
  seedFoundation(db);

  const audit = createAuditLog(db);
  return composeStores<SQLiteStore>(
    createHealthStore(db, location),
    createAuthStore(db, audit),
    createProjectStore(db, audit),
    createCrawlStore(db, audit),
    createJobStore(db, audit),
    createSourceMapStore(db),
    { close: () => db.close() }
  );
}

function composeStores<TStore extends object>(...stores: object[]): TStore {
  const composed: Record<string, unknown> = {};
  for (const store of stores) {
    for (const key of Reflect.ownKeys(store)) {
      if (key !== "constructor") {
        composed[key as string] = (store as Record<string, unknown>)[key as string];
      }
    }
    const prototype = Object.getPrototypeOf(store) as object | null;
    if (!prototype) {
      continue;
    }
    for (const key of Reflect.ownKeys(prototype)) {
      if (key === "constructor") {
        continue;
      }
      const value = (prototype as Record<string, unknown>)[key as string];
      composed[key as string] = typeof value === "function" ? value.bind(store) : value;
    }
  }
  return composed as TStore;
}

function createHealthStore(_db: SQLiteDatabase, location: string): HealthStore {
  return {
    health(): HealthSnapshot {
      return {
        status: "ok",
        service: "api",
        version: apiDefaults.version,
        checkedAt: new Date().toISOString(),
        checks: [
          { name: "http", status: "ok" },
          { name: "sqlite", status: "ok", details: location },
          { name: "auth_tables", status: "ok", details: "users and sessions are stored in the embedded backend." },
          { name: "raw_normalized_contract", status: "ok", details: "raw_events and normalized_metrics are separate tables." }
        ]
      };
    }
  };
}

export function sqliteLocation(databaseUrl: string): string {
  if (databaseUrl === "sqlite::memory:" || databaseUrl === ":memory:") {
    return ":memory:";
  }
  if (databaseUrl.startsWith("sqlite:")) {
    return resolve(databaseUrl.slice("sqlite:".length));
  }
  return resolve(databaseUrl);
}
