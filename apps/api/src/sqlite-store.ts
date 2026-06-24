import { DomainValidationError, type HealthSnapshot } from "@seo-tool/domain-model";
import { apiDefaults } from "@seo-tool/shared-config";
import { createDatabase, type AsyncDatabase } from "./db/index.js";
import { runMigrations } from "./db/migrate.js";
import { createAuditLog } from "./stores/audit-log.js";
import { createAiStore, type AiStore } from "./stores/ai-store.js";
import { createAlertStore, type AlertStore } from "./stores/alert-store.js";
import { createAuthStore, type AuthStore, type LoginResult, type RegisterInput } from "./stores/auth-store.js";
import { createBacklinkStore, type BacklinkStore } from "./stores/backlink-store.js";
import { createCrawlStore, type CrawlStore, type RecordAuditIssuesScope } from "./stores/crawl-store.js";
import { createJobStore, type JobStore } from "./stores/job-store.js";
import { createKeywordStore, type KeywordStore } from "./stores/keyword-store.js";
import { createLinkGraphStore, type LinkGraphStore } from "./stores/link-graph-store.js";
import { createOpportunityStore, type OpportunityStore } from "./stores/opportunity-store.js";
import { createProjectStore, type ProjectStore } from "./stores/project-store.js";
import { createProposalStore, type ProposalStore } from "./stores/proposal-store.js";
import { createRankStore, type RankStore } from "./stores/rank-store.js";
import { createReportStore, type ReportStore } from "./stores/report-store.js";
import { createSearchPerformanceStore, type SearchPerformanceStore } from "./stores/search-performance-store.js";
import { createSourceMapStore, type SourceMapStore } from "./stores/source-map-store.js";
import { RequestError } from "./stores/store-errors.js";
import { seedFoundation } from "./sqlite-seed.js";

export interface HealthStore {
  health(): HealthSnapshot;
}

export type BackendStore = HealthStore & AuthStore & ProjectStore & CrawlStore & JobStore & SourceMapStore & LinkGraphStore & OpportunityStore & KeywordStore & RankStore & SearchPerformanceStore & BacklinkStore & ReportStore & AlertStore & AiStore & ProposalStore & {
  close(): Promise<void>;
};

export type SQLiteStore = BackendStore;

export { RequestError };
export type { AiStore, AlertStore, AuthStore, BacklinkStore, CrawlStore, JobStore, KeywordStore, LinkGraphStore, LoginResult, OpportunityStore, ProjectStore, ProposalStore, RankStore, RecordAuditIssuesScope, RegisterInput, ReportStore, SearchPerformanceStore, SourceMapStore };

export async function createSQLiteStore(databaseUrl = apiDefaults.databaseUrl): Promise<BackendStore> {
  const db = await createDatabase(databaseUrl);
  await runMigrations(db);
  await seedFoundation(db);

  const audit = createAuditLog(db);
  return composeStores<BackendStore>([
    createHealthStore(db, databaseUrl),
    withDomainValidation(createAuthStore(db, audit)),
    withDomainValidation(createProjectStore(db, audit)),
    createCrawlStore(db, audit),
    createJobStore(db, audit),
    createSourceMapStore(db, audit),
    createLinkGraphStore(db, audit),
    withDomainValidation(createOpportunityStore(db, audit)),
    createKeywordStore(db, audit),
    createRankStore(db, audit),
    createSearchPerformanceStore(db, audit),
    createBacklinkStore(db, audit),
    createReportStore(db, audit),
    createAlertStore(db, audit),
    createAiStore(db, audit),
    createProposalStore(db, audit),
    { close: () => db.close() }
  ]);
}

function createHealthStore(_db: AsyncDatabase, location: string): HealthStore {
  return {
    health(): HealthSnapshot {
      return {
        status: "ok",
        service: "api",
        version: apiDefaults.version,
        checkedAt: new Date().toISOString(),
        checks: [
          { name: "http", status: "ok" },
          { name: "database", status: "ok", details: location },
          { name: "auth_tables", status: "ok", details: "users and sessions are stored in the backend database." },
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
      // Store methods are async; await the result so a DomainValidationError
      // surfacing as a rejected promise is translated to a RequestError.
      return async (...args: unknown[]) => {
        try {
          return await (value as (...a: unknown[]) => unknown).apply(target, args);
        } catch (error) {
          if (error instanceof DomainValidationError) {
            throw new RequestError(400, "validation_error", error.message);
          }
          throw error;
        }
      };
    }
  });
}
