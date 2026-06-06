import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { DomainValidationError, type HealthSnapshot } from "@seo-tool/domain-model";
import { apiDefaults } from "@seo-tool/shared-config";
import { createAuditLog } from "./stores/audit-log.js";
import { createAuthStore, type AuthStore, type LoginResult, type RegisterInput } from "./stores/auth-store.js";
import { createCrawlStore, type CrawlStore, type RecordAuditIssuesScope } from "./stores/crawl-store.js";
import { createJobStore, type JobStore } from "./stores/job-store.js";
import { createLinkGraphStore, type LinkGraphStore } from "./stores/link-graph-store.js";
import { createOpportunityStore, type OpportunityStore } from "./stores/opportunity-store.js";
import { createProjectStore, type ProjectStore } from "./stores/project-store.js";
import { createSourceMapStore, type SourceMapStore } from "./stores/source-map-store.js";
import { RequestError } from "./stores/store-errors.js";
import type { SQLiteDatabase } from "./stores/sqlite-types.js";
import { runSQLiteMigrations } from "./sqlite-migrations.js";
import { seedFoundation } from "./sqlite-seed.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (location: string) => SQLiteDatabase;
};

export interface HealthStore {
  health(): HealthSnapshot;
}

export type BackendStore = HealthStore & AuthStore & ProjectStore & CrawlStore & JobStore & SourceMapStore & LinkGraphStore & OpportunityStore & {
  close(): void;
};

export type SQLiteStore = BackendStore;

export { RequestError };
export type { AuthStore, CrawlStore, JobStore, LinkGraphStore, LoginResult, OpportunityStore, ProjectStore, RecordAuditIssuesScope, RegisterInput, SourceMapStore };

export function createSQLiteStore(databaseUrl = apiDefaults.databaseUrl): BackendStore {
  const location = sqliteLocation(databaseUrl);
  if (location !== ":memory:") {
    mkdirSync(dirname(location), { recursive: true });
  }

  const db = new DatabaseSync(location);
  runSQLiteMigrations(db);
  seedFoundation(db);

  const audit = createAuditLog(db);
  return composeStores<BackendStore>([
    createHealthStore(db, location),
    withDomainValidation(createAuthStore(db, audit)),
    withDomainValidation(createProjectStore(db, audit)),
    createCrawlStore(db, audit),
    createJobStore(db, audit),
    createSourceMapStore(db),
    createLinkGraphStore(db, audit),
    withDomainValidation(createOpportunityStore(db, audit)),
    { close: () => db.close() }
  ]);
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

function composeStores<TStore extends object>(stores: object[]): TStore {
  const composed: Record<string, unknown> = {};
  for (const store of stores) {
    copyEnumerableMembers(composed, store);
    const prototype = Object.getPrototypeOf(store) as object | null;
    if (prototype) {
      copyPrototypeMethods(composed, store, prototype);
    }
  }
  return composed as TStore;
}

function copyEnumerableMembers(target: Record<string, unknown>, source: object): void {
  for (const key of Object.keys(source)) {
    const value = (source as Record<string, unknown>)[key];
    target[key] = typeof value === "function" ? value.bind(source) : value;
  }
}

function copyPrototypeMethods(target: Record<string, unknown>, source: object, prototype: object): void {
  for (const key of Object.getOwnPropertyNames(prototype)) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    if (!descriptor || typeof descriptor.value !== "function") continue;
    const value = (source as Record<string, unknown>)[key];
    target[key] = typeof value === "function" ? value.bind(source) : value;
  }
}

function withDomainValidation<TStore extends object>(store: TStore): TStore {
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => validateDomainInput(() => value.apply(target, args));
    }
  });
}

function validateDomainInput<T>(validator: () => T): T {
  try {
    return validator();
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new RequestError(400, "validation_error", error.message);
    }
    throw error;
  }
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
