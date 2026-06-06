import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmail, validatePassword } from "../src/auth.js";
import { calculateHealthScore } from "../src/crawl.js";
import { sourceConfidenceForProvider } from "../src/integrations.js";
import { createCrawlSeedJobInput, makeIdempotencyKey, validateCrawlSeedJobPayload } from "../src/jobs.js";
import { hasRequiredEvidence, scoreOpportunity, type Opportunity } from "../src/opportunities.js";
import { validateBusinessValue, type Market, type Project, type Site } from "../src/project.js";

test("auth normalizes credentials and enforces minimum password length", () => {
  assert.equal(normalizeEmail(" User@Example.COM "), "user@example.com");
  assert.equal(validatePassword("very-long-password"), "very-long-password");
  assert.throws(() => normalizeEmail("not-an-email"), /email/);
  assert.throws(() => validatePassword("short"), /password/);
});

test("project models markets and validates business value range", () => {
  const market: Market = { country: "DE", language: "de", device: "desktop", searchEngine: "google" };
  const project: Project = {
    id: "project-1",
    name: "Example",
    slug: "example",
    status: "active",
    defaultLocale: "de-DE",
    markets: [market],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  const site: Site = {
    id: "site-1",
    projectId: project.id,
    scopeType: "domain",
    baseUrl: "https://example.com",
    crawlFrequency: "weekly",
    businessValue: validateBusinessValue(50)
  };

  assert.equal(project.markets[0]?.language, "de");
  assert.equal(site.businessValue, 50);
  assert.throws(() => validateBusinessValue(0), /businessValue/);
  assert.throws(() => validateBusinessValue(101), /businessValue/);
});

test("crawl health score applies severity penalties with a lower bound", () => {
  assert.equal(calculateHealthScore([{ severity: "critical" }, { severity: "high" }, { severity: "low" }]), 70);
  assert.equal(calculateHealthScore(Array.from({ length: 10 }, () => ({ severity: "critical" as const }))), 0);
});

test("jobs create stable idempotency keys and typed crawl seed inputs", () => {
  assert.equal(makeIdempotencyKey("project-1", "connector_sync", "GSC Daily"), "project-1:connector_sync:gsc-daily");
  const input = createCrawlSeedJobInput({ siteId: "site-1", baseUrl: "https://example.com", crawlRunId: "crawl-1", sitemapUrl: "https://example.com/sitemap.xml" });
  assert.equal(input.type, "crawl_seed");
  assert.equal(input.subject, "https://example.com/:run:crawl-1");
  assert.deepEqual(input.payload, { siteId: "site-1", baseUrl: "https://example.com/", crawlRunId: "crawl-1", sitemapUrl: "https://example.com/sitemap.xml" });
  assert.deepEqual(validateCrawlSeedJobPayload(input.payload), input.payload);
  assert.deepEqual(validateCrawlSeedJobPayload({ siteId: "site-1", baseUrl: "https://example.com" }), { siteId: "site-1", baseUrl: "https://example.com/" });
  assert.throws(() => validateCrawlSeedJobPayload({ siteId: "site-1", baseUrl: "not-a-url", crawlRunId: "crawl-1" }), /baseUrl/);
});

test("integrations map providers to source confidence classes", () => {
  assert.equal(sourceConfidenceForProvider("ga4"), "A");
  assert.equal(sourceConfidenceForProvider("gsc"), "B");
  assert.equal(sourceConfidenceForProvider("serp"), "C");
  assert.equal(sourceConfidenceForProvider("backlink"), "D");
});

test("opportunities score priority signals and require trusted evidence", () => {
  assert.equal(
    scoreOpportunity({
      expectedImpact: 0.8,
      confidence: 0.9,
      businessValue: 0.7,
      urgency: 0.6,
      effort: 0.3
    }),
    101
  );

  const opportunity = {
    evidence: [{ sourceConfidence: "B" }]
  } as Pick<Opportunity, "evidence">;

  assert.equal(hasRequiredEvidence(opportunity), true);
  assert.equal(hasRequiredEvidence({ evidence: [{ sourceConfidence: "D" }] } as Pick<Opportunity, "evidence">), false);
  assert.throws(
    () =>
      scoreOpportunity({
        expectedImpact: 0.8,
        confidence: 0.9,
        businessValue: 0.7,
        urgency: 0.6,
        effort: 0
      }),
    /effort/
  );
});
