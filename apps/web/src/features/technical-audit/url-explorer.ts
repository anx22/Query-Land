/**
 * url-explorer.ts — pure, unit-testable helpers for the URL-Explorer section of
 * the Technical Audit overview (T3).
 *
 * No "use client" / no React: everything here is a pure function so it can be
 * tested with vitest and reused by both the server page (pagination href
 * builder, page math) and the client table/drawer (row + drawer formatting).
 */

import type {
  DiscoveredUrl,
  FetchStatusClass,
  IndexabilityRecord,
  IndexabilityState,
  UrlFetchRecord,
} from "@seo-tool/domain-model";

/** Web-side mirror of the API's UrlExplorerRow (apps/api crawl-store). */
export interface UrlExplorerRow {
  discoveredUrl: DiscoveredUrl;
  latestFetch: UrlFetchRecord | null;
  latestIndexability: IndexabilityRecord | null;
}

/** Page size for the URL-Explorer table. */
export const URL_EXPLORER_PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// URL-Explorer server-side filter (fetch status class + discovery source)
// ---------------------------------------------------------------------------

export type UrlStatusFilter = "all" | FetchStatusClass;
export type UrlSourceFilter = "all" | "seed" | "sitemap" | "link";

export interface UrlExplorerFilter {
  status: UrlStatusFilter;
  source: UrlSourceFilter;
  /** Case-insensitive URL substring search ("" = no search). */
  q: string;
}

export const URL_STATUS_FILTERS: UrlStatusFilter[] = [
  "all",
  "success",
  "redirect",
  "client_error",
  "server_error",
  "network_error",
];
export const URL_SOURCE_FILTERS: UrlSourceFilter[] = ["all", "seed", "sitemap", "link"];

const URL_STATUS_FILTER_LABEL: Record<UrlStatusFilter, string> = {
  all: "Alle",
  success: "Erfolg",
  redirect: "Weiterleitung",
  client_error: "Client-Fehler",
  server_error: "Server-Fehler",
  network_error: "Netzwerkfehler",
};

const URL_SOURCE_FILTER_LABEL: Record<UrlSourceFilter, string> = {
  all: "Alle",
  seed: "Seed",
  sitemap: "Sitemap",
  link: "Link",
};

/** Label for a URL-Explorer status filter value (German). */
export function urlStatusFilterLabel(value: UrlStatusFilter): string {
  return URL_STATUS_FILTER_LABEL[value] ?? value;
}

/** Label for a URL-Explorer source filter value (German). */
export function urlSourceFilterLabel(value: UrlSourceFilter): string {
  return URL_SOURCE_FILTER_LABEL[value] ?? value;
}

/** Normalize raw query input into a valid URL-Explorer filter (default = all/all). */
export function resolveUrlExplorerFilter(
  input: { urlStatus?: string; urlSource?: string; urlQ?: string } = {}
): UrlExplorerFilter {
  const status = URL_STATUS_FILTERS.includes(input.urlStatus as UrlStatusFilter)
    ? (input.urlStatus as UrlStatusFilter)
    : "all";
  const source = URL_SOURCE_FILTERS.includes(input.urlSource as UrlSourceFilter)
    ? (input.urlSource as UrlSourceFilter)
    : "all";
  const q = (input.urlQ ?? "").trim();
  return { status, source, q };
}

export function isDefaultUrlExplorerFilter(filter: UrlExplorerFilter): boolean {
  return filter.status === "all" && filter.source === "all" && filter.q === "";
}

/**
 * Build a /technical-audit href that overrides a single URL-Explorer filter
 * dimension, omitting default ("all") values and ALWAYS resetting urlOffset to 0
 * (a filter change invalidates the current page). Preserves other params.
 */
export function urlFilterHref(
  current: Record<string, string | undefined>,
  filter: UrlExplorerFilter
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key === "urlStatus" || key === "urlSource" || key === "urlQ" || key === "urlOffset") continue;
    if (value != null && value !== "") params.set(key, value);
  }
  if (filter.status !== "all") params.set("urlStatus", filter.status);
  if (filter.source !== "all") params.set("urlSource", filter.source);
  if (filter.q !== "") params.set("urlQ", filter.q);
  const qs = params.toString();
  return qs ? `/technical-audit?${qs}` : "/technical-audit";
}

// ---------------------------------------------------------------------------
// Pagination math + href building
// ---------------------------------------------------------------------------

export interface PageInfo {
  /** Zero-based offset of the current page. */
  offset: number;
  /** Page size. */
  pageSize: number;
  /** Total number of rows across all pages. */
  total: number;
  /** One-based current page number. */
  page: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
  /** True when there is a previous page. */
  hasPrev: boolean;
  /** True when there is a next page. */
  hasNext: boolean;
  /** Offset of the previous page (clamped to >= 0). */
  prevOffset: number;
  /** Offset of the next page. */
  nextOffset: number;
}

/** Normalize an arbitrary raw offset query value into a valid, page-aligned offset. */
export function resolveOffset(raw: string | undefined, pageSize: number, total?: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  let offset = Math.floor(parsed / pageSize) * pageSize;
  if (typeof total === "number" && offset >= total) {
    offset = total <= 0 ? 0 : Math.floor((total - 1) / pageSize) * pageSize;
  }
  return Math.max(0, offset);
}

/** Compute page navigation info from an offset, page size and total count. */
export function computePageInfo(offset: number, pageSize: number, total: number): PageInfo {
  const safeSize = Math.max(1, pageSize);
  const safeTotal = Math.max(0, total);
  const safeOffset = Math.max(0, offset);
  const pageCount = Math.max(1, Math.ceil(safeTotal / safeSize));
  const page = Math.min(pageCount, Math.floor(safeOffset / safeSize) + 1);
  return {
    offset: safeOffset,
    pageSize: safeSize,
    total: safeTotal,
    page,
    pageCount,
    hasPrev: safeOffset > 0,
    hasNext: safeOffset + safeSize < safeTotal,
    prevOffset: Math.max(0, safeOffset - safeSize),
    nextOffset: safeOffset + safeSize,
  };
}

/**
 * Build a /technical-audit href that preserves existing query params but
 * overrides a single offset param (omitting it when it is 0). Mirrors the
 * IssueFilterBar href pattern (default values are omitted from the URL).
 */
export function paginationHref(
  current: Record<string, string | undefined>,
  param: string,
  offset: number
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key === param) continue;
    if (value != null && value !== "") params.set(key, value);
  }
  if (offset > 0) params.set(param, String(offset));
  const qs = params.toString();
  return qs ? `/technical-audit?${qs}` : "/technical-audit";
}

// ---------------------------------------------------------------------------
// Row + drawer formatting
// ---------------------------------------------------------------------------

const FETCH_STATUS_CLASS_LABEL: Record<FetchStatusClass, string> = {
  success: "Erfolg",
  redirect: "Weiterleitung",
  client_error: "Client-Fehler",
  server_error: "Server-Fehler",
  network_error: "Netzwerkfehler",
};

const INDEXABILITY_STATE_LABEL: Record<IndexabilityState, string> = {
  indexable: "Indexierbar",
  blocked_by_status: "Durch Statuscode blockiert",
  blocked_by_meta: "Durch Meta-Robots blockiert",
  blocked_by_x_robots: "Durch X-Robots-Tag blockiert",
  blocked_by_robots: "Durch robots.txt blockiert",
  canonicalized: "Kanonisiert",
};

/** Human-readable label for a fetch status class (German). */
export function fetchStatusClassLabel(statusClass: FetchStatusClass | null | undefined): string {
  if (!statusClass) return "—";
  return FETCH_STATUS_CLASS_LABEL[statusClass] ?? statusClass;
}

/** Human-readable label for an indexability state (German). */
export function indexabilityStateLabel(state: IndexabilityState | null | undefined): string {
  if (!state) return "—";
  return INDEXABILITY_STATE_LABEL[state] ?? state;
}

/** Functional badge tone for an indexability state (paired with text). */
export function indexabilityBadgeTone(record: IndexabilityRecord | null): "success" | "warning" | "" {
  if (!record) return "";
  return record.isIndexable ? "success" : "warning";
}

/** Functional badge tone for a fetch record based on its status class. */
export function fetchBadgeTone(fetch: UrlFetchRecord | null): "success" | "warning" | "danger" | "" {
  if (!fetch) return "";
  switch (fetch.statusClass) {
    case "success":
      return "success";
    case "redirect":
      return "warning";
    case "client_error":
    case "server_error":
    case "network_error":
      return "danger";
    default:
      return "";
  }
}

/** Compact display of the HTTP status (code + class) for a fetch record. */
export function formatHttpStatus(fetch: UrlFetchRecord | null): string {
  if (!fetch) return "—";
  const code = fetch.statusCode != null ? String(fetch.statusCode) : "—";
  return `${code} · ${fetchStatusClassLabel(fetch.statusClass)}`;
}

/** Format an ISO timestamp for the table / drawer; "—" when missing/invalid. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE");
}

/** Redirect target = final URL when it differs from the requested URL. */
export function redirectTarget(fetch: UrlFetchRecord | null): string | null {
  if (!fetch) return null;
  if (fetch.finalUrl && fetch.finalUrl !== fetch.url) return fetch.finalUrl;
  return null;
}

/** Content-Type header (case-insensitive lookup), or null when absent. */
export function contentType(fetch: UrlFetchRecord | null): string | null {
  if (!fetch?.headers) return null;
  for (const [key, value] of Object.entries(fetch.headers)) {
    if (key.toLowerCase() === "content-type") return value;
  }
  return null;
}

export interface DrawerFacts {
  url: string;
  statusCode: string;
  statusClass: string;
  redirectTarget: string | null;
  contentType: string | null;
  indexabilityState: string;
  isIndexable: boolean | null;
  reasons: string[];
  canonicalUrl: string | null;
  fetchedAt: string | null;
  assessedAt: string | null;
  source: string;
  depth: number;
  discoveredFrom: string | null;
}

/** Derive all drawer fields from a row in one place (pure → testable). */
export function deriveDrawerFacts(row: UrlExplorerRow): DrawerFacts {
  const { discoveredUrl, latestFetch, latestIndexability } = row;
  return {
    url: discoveredUrl.normalizedUrl || discoveredUrl.url,
    statusCode: latestFetch?.statusCode != null ? String(latestFetch.statusCode) : "—",
    statusClass: fetchStatusClassLabel(latestFetch?.statusClass),
    redirectTarget: redirectTarget(latestFetch),
    contentType: contentType(latestFetch),
    indexabilityState: indexabilityStateLabel(latestIndexability?.state),
    isIndexable: latestIndexability ? latestIndexability.isIndexable : null,
    reasons: latestIndexability?.reasons ?? [],
    canonicalUrl: latestIndexability?.canonicalUrl ?? null,
    fetchedAt: latestFetch?.fetchedAt ?? null,
    assessedAt: latestIndexability?.assessedAt ?? null,
    source: discoveredUrl.source,
    depth: discoveredUrl.depth,
    discoveredFrom: discoveredUrl.discoveredFrom,
  };
}
