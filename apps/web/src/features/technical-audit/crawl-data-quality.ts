import type { CrawlRun } from "@seo-tool/domain-model";

/**
 * crawl-data-quality.ts — pure derivation of an honest data-quality notice from
 * the latest crawl-run summary. A high Health Score computed over a single page
 * (or a truncated crawl) must never read as "everything is fine": this surfaces
 * a "thin" or "partial" caveat next to the score. No React → unit-testable.
 */

export type CrawlDataQualityLevel = "thin" | "partial";

export interface CrawlDataQualityNotice {
  level: CrawlDataQualityLevel;
  message: string;
}

/**
 * Returns a caveat when the latest run's data is thin (only one page fetched) or
 * partial (more URLs were discovered than crawled — a cap/limit was hit), else
 * null. Derived purely from the persisted summary counts (no schema change).
 */
export function deriveCrawlDataQuality(summary: CrawlRun["summary"] | null | undefined): CrawlDataQualityNotice | null {
  if (!summary) return null;
  const fetchedUrls = summary.fetchedUrls ?? 0;
  const discoveredUrls = summary.discoveredUrls ?? 0;
  if (fetchedUrls <= 0) return null; // nothing crawled yet — the empty-state copy covers this

  if (fetchedUrls === 1) {
    return {
      level: "thin",
      message:
        "Dünne Datenlage: Es wurde nur eine Seite erfasst. Der Health Score ist dadurch nur eingeschränkt aussagekräftig — folgt der Crawler keinen internen Links, prüfen Sie Startseite, robots.txt und Sitemap."
    };
  }

  if (discoveredUrls > fetchedUrls) {
    const uncrawled = discoveredUrls - fetchedUrls;
    return {
      level: "partial",
      message: `Teilergebnis: ${uncrawled.toLocaleString("de-DE")} entdeckte URL(s) wurden noch nicht gecrawlt (Limit erreicht). Der Health Score bewertet nur die tatsächlich gecrawlten Seiten.`
    };
  }

  return null;
}
