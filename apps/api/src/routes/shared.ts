import type { ApiResponse } from "../http.js";
import type { AlertStore, BacklinkStore, CrawlStore, JobStore, KeywordStore, LinkGraphStore, OpportunityStore, ProjectStore, RankStore, ReportStore, SearchPerformanceStore, SourceMapStore } from "../sqlite-store.js";

// Store-Slice, den alle ressourcenspezifischen Routen-Module gemeinsam erwarten.
export type ProjectChildStore = ProjectStore & CrawlStore & JobStore & SourceMapStore & LinkGraphStore & OpportunityStore & KeywordStore & RankStore & SearchPerformanceStore & BacklinkStore & ReportStore & AlertStore;

// Einheitliche Signatur jedes Ressourcen-Routers: liefert eine ApiResponse, wenn er den
// Pfad bedient, sonst null (der Aggregator probiert dann den nächsten Router).
export type ResourceRoute = (
  store: ProjectChildStore,
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  body: unknown
) => ApiResponse | null;

export interface RoutePage<T> {
  data: T[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export function paginationOptions(searchParams: URLSearchParams): { limit?: number; offset?: number } {
  const limit = positiveInt(searchParams.get("limit"));
  const offset = cursorOffset(searchParams.get("cursor")) ?? nonNegativeInt(searchParams.get("offset"));
  return { limit, offset };
}

export function pageMeta<T>(page: RoutePage<T>): Omit<RoutePage<T>, "data"> {
  return { limit: page.limit, offset: page.offset, total: page.total, nextCursor: page.nextCursor };
}

export function enumQuery<const T extends string>(searchParams: URLSearchParams, key: string, allowed: readonly T[]): T | undefined {
  const value = searchParams.get(key);
  return value && (allowed as readonly string[]).includes(value) ? value as T : undefined;
}

function positiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function cursorOffset(value: string | null): number | undefined {
  if (!value) return undefined;
  const direct = nonNegativeInt(value);
  if (direct !== undefined) return direct;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const match = /^offset:(\d+)$/.exec(decoded);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}
