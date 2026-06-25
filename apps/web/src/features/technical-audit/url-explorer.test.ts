import { describe, expect, it } from "vitest";
import type { UrlFetchRecord, IndexabilityRecord, DiscoveredUrl } from "@seo-tool/domain-model";
import {
  computePageInfo,
  contentType,
  deriveDrawerFacts,
  fetchBadgeTone,
  fetchStatusClassLabel,
  formatHttpStatus,
  formatTimestamp,
  indexabilityBadgeTone,
  indexabilityStateLabel,
  paginationHref,
  redirectTarget,
  resolveOffset,
  resolveUrlExplorerFilter,
  isDefaultUrlExplorerFilter,
  urlFilterHref,
  URL_EXPLORER_PAGE_SIZE,
  type UrlExplorerRow,
} from "./url-explorer";

// --- URL-Explorer filter (fetch status class + source) ---

describe("resolveUrlExplorerFilter", () => {
  it("defaults to all/all", () => {
    expect(resolveUrlExplorerFilter()).toEqual({ status: "all", source: "all" });
    expect(resolveUrlExplorerFilter({ urlStatus: "bogus", urlSource: "nope" })).toEqual({
      status: "all",
      source: "all",
    });
  });

  it("accepts valid status and source values", () => {
    expect(resolveUrlExplorerFilter({ urlStatus: "server_error", urlSource: "sitemap" })).toEqual({
      status: "server_error",
      source: "sitemap",
    });
  });
});

describe("isDefaultUrlExplorerFilter", () => {
  it("is true only for all/all", () => {
    expect(isDefaultUrlExplorerFilter({ status: "all", source: "all" })).toBe(true);
    expect(isDefaultUrlExplorerFilter({ status: "redirect", source: "all" })).toBe(false);
    expect(isDefaultUrlExplorerFilter({ status: "all", source: "link" })).toBe(false);
  });
});

describe("urlFilterHref", () => {
  it("omits default values and resets urlOffset", () => {
    expect(urlFilterHref({ urlOffset: "50" }, { status: "all", source: "all" })).toBe(
      "/technical-audit"
    );
  });

  it("sets non-default filter params and drops the old urlOffset", () => {
    const href = urlFilterHref(
      { urlOffset: "50", urlStatus: "success" },
      { status: "redirect", source: "sitemap" }
    );
    expect(href).toContain("urlStatus=redirect");
    expect(href).toContain("urlSource=sitemap");
    expect(href).not.toContain("urlOffset");
  });

  it("preserves unrelated params (e.g. issue filters)", () => {
    const href = urlFilterHref({ status: "resolved" }, { status: "client_error", source: "all" });
    expect(href).toContain("status=resolved");
    expect(href).toContain("urlStatus=client_error");
  });
});

// --- pagination math ---

describe("resolveOffset", () => {
  it("defaults to 0 for missing/invalid/negative input", () => {
    expect(resolveOffset(undefined, 25)).toBe(0);
    expect(resolveOffset("abc", 25)).toBe(0);
    expect(resolveOffset("-10", 25)).toBe(0);
    expect(resolveOffset("0", 25)).toBe(0);
  });
  it("aligns offsets down to a page boundary", () => {
    expect(resolveOffset("25", 25)).toBe(25);
    expect(resolveOffset("30", 25)).toBe(25);
    expect(resolveOffset("51", 25)).toBe(50);
  });
  it("clamps to the last page when total is known", () => {
    expect(resolveOffset("100", 25, 40)).toBe(25);
    expect(resolveOffset("100", 25, 0)).toBe(0);
  });
});

describe("computePageInfo", () => {
  it("computes page numbers and nav flags for a middle page", () => {
    const info = computePageInfo(25, 25, 80);
    expect(info.page).toBe(2);
    expect(info.pageCount).toBe(4);
    expect(info.hasPrev).toBe(true);
    expect(info.hasNext).toBe(true);
    expect(info.prevOffset).toBe(0);
    expect(info.nextOffset).toBe(50);
  });
  it("handles the first page with no previous", () => {
    const info = computePageInfo(0, 25, 80);
    expect(info.page).toBe(1);
    expect(info.hasPrev).toBe(false);
    expect(info.prevOffset).toBe(0);
  });
  it("handles the last page with no next", () => {
    const info = computePageInfo(75, 25, 80);
    expect(info.page).toBe(4);
    expect(info.pageCount).toBe(4);
    expect(info.hasNext).toBe(false);
  });
  it("returns a single page for empty results", () => {
    const info = computePageInfo(0, 25, 0);
    expect(info.page).toBe(1);
    expect(info.pageCount).toBe(1);
    expect(info.hasPrev).toBe(false);
    expect(info.hasNext).toBe(false);
  });
  it("uses the default page size constant", () => {
    expect(URL_EXPLORER_PAGE_SIZE).toBeGreaterThan(0);
  });
});

// --- href builder ---

describe("paginationHref", () => {
  it("omits the offset param when offset is 0", () => {
    expect(paginationHref({}, "urlOffset", 0)).toBe("/technical-audit");
  });
  it("sets the offset param for non-zero offsets", () => {
    expect(paginationHref({}, "urlOffset", 25)).toBe("/technical-audit?urlOffset=25");
  });
  it("preserves other params while overriding the target offset", () => {
    const href = paginationHref(
      { status: "resolved", runOffset: "5", urlOffset: "50" },
      "urlOffset",
      25
    );
    expect(href).toContain("status=resolved");
    expect(href).toContain("runOffset=5");
    expect(href).toContain("urlOffset=25");
    expect(href).not.toContain("urlOffset=50");
  });
  it("drops empty/undefined params", () => {
    expect(paginationHref({ status: undefined, severity: "" }, "runOffset", 5)).toBe(
      "/technical-audit?runOffset=5"
    );
  });
});

// --- formatting ---

describe("label helpers", () => {
  it("labels fetch status classes in German with fallback", () => {
    expect(fetchStatusClassLabel("success")).toBe("Erfolg");
    expect(fetchStatusClassLabel("server_error")).toBe("Server-Fehler");
    expect(fetchStatusClassLabel(null)).toBe("—");
  });
  it("labels indexability states in German with fallback", () => {
    expect(indexabilityStateLabel("indexable")).toBe("Indexierbar");
    expect(indexabilityStateLabel("blocked_by_robots")).toBe("Durch robots.txt blockiert");
    expect(indexabilityStateLabel(undefined)).toBe("—");
  });
});

const fetchRecord = (over: Partial<UrlFetchRecord> = {}): UrlFetchRecord => ({
  id: "f1",
  projectId: "p1",
  siteId: "s1",
  discoveredUrlId: "d1",
  url: "https://x.de/a",
  finalUrl: "https://x.de/a",
  statusCode: 200,
  statusClass: "success",
  headers: { "Content-Type": "text/html; charset=utf-8" },
  redirectChain: [],
  fetchedAt: "2026-06-25T10:00:00.000Z",
  ...over,
});

describe("badge tones", () => {
  it("maps fetch status classes to tones", () => {
    expect(fetchBadgeTone(fetchRecord({ statusClass: "success" }))).toBe("success");
    expect(fetchBadgeTone(fetchRecord({ statusClass: "redirect" }))).toBe("warning");
    expect(fetchBadgeTone(fetchRecord({ statusClass: "client_error" }))).toBe("danger");
    expect(fetchBadgeTone(null)).toBe("");
  });
  it("maps indexability to tones", () => {
    expect(indexabilityBadgeTone({ isIndexable: true } as IndexabilityRecord)).toBe("success");
    expect(indexabilityBadgeTone({ isIndexable: false } as IndexabilityRecord)).toBe("warning");
    expect(indexabilityBadgeTone(null)).toBe("");
  });
});

describe("formatHttpStatus", () => {
  it("combines code and class", () => {
    expect(formatHttpStatus(fetchRecord({ statusCode: 301, statusClass: "redirect" }))).toBe(
      "301 · Weiterleitung"
    );
  });
  it("handles missing status code and null fetch", () => {
    expect(formatHttpStatus(fetchRecord({ statusCode: null }))).toBe("— · Erfolg");
    expect(formatHttpStatus(null)).toBe("—");
  });
});

describe("formatTimestamp", () => {
  it("returns dash for missing/invalid timestamps", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp("not-a-date")).toBe("—");
  });
  it("formats valid timestamps", () => {
    expect(formatTimestamp("2026-06-25T10:00:00.000Z")).not.toBe("—");
  });
});

describe("redirectTarget", () => {
  it("returns finalUrl when it differs from url", () => {
    expect(redirectTarget(fetchRecord({ url: "https://x.de/a", finalUrl: "https://x.de/b" }))).toBe(
      "https://x.de/b"
    );
  });
  it("returns null when there is no redirect", () => {
    expect(redirectTarget(fetchRecord())).toBeNull();
    expect(redirectTarget(null)).toBeNull();
  });
});

describe("contentType", () => {
  it("reads the Content-Type header case-insensitively", () => {
    expect(contentType(fetchRecord({ headers: { "content-type": "application/json" } }))).toBe(
      "application/json"
    );
  });
  it("returns null when absent", () => {
    expect(contentType(fetchRecord({ headers: {} }))).toBeNull();
    expect(contentType(null)).toBeNull();
  });
});

// --- drawer facts ---

const discovered = (over: Partial<DiscoveredUrl> = {}): DiscoveredUrl => ({
  id: "d1",
  projectId: "p1",
  siteId: "s1",
  url: "https://x.de/a",
  normalizedUrl: "https://x.de/a",
  source: "sitemap",
  discoveredFrom: null,
  depth: 0,
  discoveredAt: "2026-06-24T00:00:00.000Z",
  ...over,
});

describe("deriveDrawerFacts", () => {
  it("derives a full fact set from a populated row", () => {
    const row: UrlExplorerRow = {
      discoveredUrl: discovered({ depth: 2, source: "link", discoveredFrom: "https://x.de/" }),
      latestFetch: fetchRecord({
        statusCode: 301,
        statusClass: "redirect",
        url: "https://x.de/a",
        finalUrl: "https://x.de/b",
        headers: { "Content-Type": "text/html" },
      }),
      latestIndexability: {
        id: "i1",
        projectId: "p1",
        siteId: "s1",
        discoveredUrlId: "d1",
        fetchResultId: "f1",
        url: "https://x.de/a",
        state: "canonicalized",
        isIndexable: false,
        reasons: ["canonical points elsewhere"],
        canonicalUrl: "https://x.de/b",
        assessedAt: "2026-06-25T11:00:00.000Z",
      },
    };
    const facts = deriveDrawerFacts(row);
    expect(facts.url).toBe("https://x.de/a");
    expect(facts.statusCode).toBe("301");
    expect(facts.statusClass).toBe("Weiterleitung");
    expect(facts.redirectTarget).toBe("https://x.de/b");
    expect(facts.contentType).toBe("text/html");
    expect(facts.indexabilityState).toBe("Kanonisiert");
    expect(facts.isIndexable).toBe(false);
    expect(facts.reasons).toEqual(["canonical points elsewhere"]);
    expect(facts.canonicalUrl).toBe("https://x.de/b");
    expect(facts.source).toBe("link");
    expect(facts.depth).toBe(2);
    expect(facts.discoveredFrom).toBe("https://x.de/");
  });

  it("handles a row with no fetch/indexability", () => {
    const facts = deriveDrawerFacts({
      discoveredUrl: discovered(),
      latestFetch: null,
      latestIndexability: null,
    });
    expect(facts.statusCode).toBe("—");
    expect(facts.statusClass).toBe("—");
    expect(facts.redirectTarget).toBeNull();
    expect(facts.contentType).toBeNull();
    expect(facts.indexabilityState).toBe("—");
    expect(facts.isIndexable).toBeNull();
    expect(facts.reasons).toEqual([]);
    expect(facts.fetchedAt).toBeNull();
  });
});
