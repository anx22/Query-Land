import { describe, expect, it } from "vitest";
import { deriveCrawlDataQuality } from "./crawl-data-quality";

const summary = (fetchedUrls: number, discoveredUrls: number) => ({
  discoveredUrls,
  fetchedUrls,
  indexabilityAssessments: fetchedUrls,
  openIssues: 0,
  healthScore: 100
});

describe("deriveCrawlDataQuality", () => {
  it("returns null when nothing has been crawled yet", () => {
    expect(deriveCrawlDataQuality(null)).toBeNull();
    expect(deriveCrawlDataQuality(summary(0, 0))).toBeNull();
  });

  it("flags a thin crawl (only the homepage fetched) so Health 100 is not misread", () => {
    const notice = deriveCrawlDataQuality(summary(1, 1));
    expect(notice?.level).toBe("thin");
  });

  it("flags a partial crawl when more URLs were discovered than fetched", () => {
    const notice = deriveCrawlDataQuality(summary(50, 150));
    expect(notice?.level).toBe("partial");
    expect(notice?.message).toContain("100"); // 150 - 50 uncrawled
  });

  it("returns null for a solid crawl (multiple pages, nothing left uncrawled)", () => {
    expect(deriveCrawlDataQuality(summary(20, 20))).toBeNull();
  });
});
