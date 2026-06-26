import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createStore, type Store as BackendStore } from "@seo-tool/api";
import type { AuditIssueRecord, DiscoveredUrl, Opportunity } from "@seo-tool/domain-model";
import { callTool } from "../src/dispatch.js";
import { createSeoMcpTools, ToolError } from "../src/tools.js";

// Each test spins up an in-memory PGlite store. Closing it per test (via the
// test context's after hook) releases the embedded WASM database promptly so no
// dangling PGlite async work outlives the run.

interface Seeded {
  store: BackendStore;
  projectId: string;
  siteId: string;
  url: string;
  discoveredUrl: DiscoveredUrl;
  opportunity: Opportunity;
}

async function seed(t: TestContext): Promise<Seeded> {
  const store = await createStore("sqlite::memory:");
  t.after(async () => { await store.close(); });
  const project = await store.createProject({ name: "MCP Test", slug: `mcp-test-${Math.random().toString(36).slice(2)}` });
  const site = await store.createSite(project.id, { baseUrl: "https://shop.example", scopeType: "domain", businessValue: 70 });
  const url = "https://shop.example/product/widget";
  const otherUrl = "https://shop.example/about";

  const discovered = await store.recordDiscoveredUrls(project.id, site.id, [
    {
      id: "du-widget",
      projectId: project.id,
      siteId: site.id,
      url,
      normalizedUrl: url,
      source: "seed",
      discoveredFrom: null,
      depth: 0,
      discoveredAt: new Date().toISOString()
    },
    {
      id: "du-about",
      projectId: project.id,
      siteId: site.id,
      url: otherUrl,
      normalizedUrl: otherUrl,
      source: "link",
      discoveredFrom: url,
      depth: 1,
      discoveredAt: new Date().toISOString()
    }
  ]);
  const discoveredUrl = discovered.urls.find((candidate) => candidate.url === url);
  assert.ok(discoveredUrl, "seeded discovered URL must exist");

  const fetch = await store.recordFetchResult(project.id, site.id, discoveredUrl.id, {
    url,
    finalUrl: url,
    statusCode: 200,
    statusClass: "success",
    headers: { "content-type": "text/html" },
    redirectChain: [],
    fetchedAt: new Date().toISOString()
  });
  await store.recordIndexabilityAssessment(project.id, site.id, discoveredUrl.id, {
    url,
    state: "indexable",
    isIndexable: true,
    reasons: [],
    canonicalUrl: url,
    fetchResultId: fetch.id,
    assessedAt: new Date().toISOString()
  });

  // Internal links: about -> widget (inlink to widget), widget -> about (outlink from widget).
  await store.recordInternalLinks(project.id, site.id, [
    { fromUrl: otherUrl, toUrl: url, anchor: "Widget", rel: null },
    { fromUrl: url, toUrl: otherUrl, anchor: "About", rel: null }
  ]);

  const issue: AuditIssueRecord = {
    id: "issue-widget-title",
    projectId: project.id,
    siteId: site.id,
    discoveredUrlId: discoveredUrl.id,
    url,
    rule: "missing_title",
    severity: "high",
    message: "Page is missing a <title> element",
    detectedAt: new Date().toISOString(),
    resolvedAt: null
  };
  await store.recordAuditIssues(project.id, site.id, [issue], { checkedDiscoveredUrlIds: [discoveredUrl.id] });

  await store.computeHealthScore(project.id, site.id);

  const opportunity = await store.createOpportunity(project.id, {
    type: "technical_fix",
    affectedUrls: [url],
    currentState: "Page is missing a title tag",
    recommendedAction: "Add a unique title tag in the product template",
    expectedImpact: 3,
    effort: 2,
    confidence: 0.8,
    businessValue: 70,
    urgency: 3,
    validationMetric: "indexable",
    evidence: [
      { source: "crawl", sourceConfidence: "A", metric: "title_present", beforeValue: "false", currentValue: "false", timeWindow: new Date().toISOString(), affectedEntity: url },
      { source: "gsc", sourceConfidence: "B", metric: "impressions", beforeValue: 100, currentValue: 120, timeWindow: "2026-05", affectedEntity: url },
      { source: "ga4", sourceConfidence: "C", metric: "sessions", beforeValue: 10, currentValue: 12, timeWindow: "2026-05", affectedEntity: url }
    ]
  });

  return { store, projectId: project.id, siteId: site.id, url, discoveredUrl, opportunity };
}

test("get_project_summary returns project, sites with health, counts and top issues", async (t) => {
  const { store, projectId, siteId } = await seed(t);
  const tools = createSeoMcpTools(store);
  const summary = (await callTool(tools, "get_project_summary", { projectId })) as {
    project: { id: string };
    sites: Array<{ site: { id: string }; latestHealthScore: { score: number } | null; openIssueCount: number }>;
    openOpportunityCount: number;
    topOpenAuditIssues: Array<{ id: string; severity: string }>;
  };

  assert.equal(summary.project.id, projectId);
  assert.equal(summary.sites.length, 1);
  assert.equal(summary.sites[0].site.id, siteId);
  assert.ok(summary.sites[0].latestHealthScore, "latest health score present");
  assert.equal(summary.sites[0].openIssueCount, 1);
  assert.equal(summary.openOpportunityCount, 1);
  assert.equal(summary.topOpenAuditIssues.length, 1);
  assert.equal(summary.topOpenAuditIssues[0].severity, "high");
});

test("get_url_dossier resolves a URL with fetch/index/links/issues/opportunities/anchor", async (t) => {
  const { store, projectId, url } = await seed(t);
  const tools = createSeoMcpTools(store);
  const dossier = (await callTool(tools, "get_url_dossier", { projectId, url })) as {
    discoveredUrl: { url: string };
    fetchHistory: unknown[];
    indexabilityAssessments: unknown[];
    inlinks: unknown[];
    outlinks: unknown[];
    auditIssues: Array<{ id: string }>;
    relatedOpportunities: Array<{ id: string }>;
    sourceAnchor: unknown;
  };

  assert.equal(dossier.discoveredUrl.url, url);
  assert.equal(dossier.fetchHistory.length, 1);
  assert.equal(dossier.indexabilityAssessments.length, 1);
  assert.equal(dossier.inlinks.length, 1);
  assert.equal(dossier.outlinks.length, 1);
  assert.equal(dossier.auditIssues.length, 1);
  assert.equal(dossier.relatedOpportunities.length, 1);

  // Unknown URL surfaces a ToolError.
  await assert.rejects(async () => await callTool(tools, "get_url_dossier", { projectId, url: "https://shop.example/missing" }), (error: unknown) => error instanceof ToolError && error.code === "unknown_url");
});

test("list_opportunities returns a priority-sorted page with evidence and validationMetric", async (t) => {
  const { store, projectId, opportunity } = await seed(t);
  const tools = createSeoMcpTools(store);
  const page = (await callTool(tools, "list_opportunities", { projectId, status: "open" })) as {
    data: Array<{ id: string; priority: number; validationMetric: string; evidence: unknown[] }>;
    total: number;
  };

  assert.equal(page.total, 1);
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0].id, opportunity.id);
  assert.equal(page.data[0].validationMetric, "indexable");
  assert.equal(page.data[0].evidence.length, 3);
  assert.ok(page.data[0].priority > 0);

  // Filtering by a non-matching type yields an empty page.
  const filtered = (await callTool(tools, "list_opportunities", { projectId, type: "money_page" })) as { total: number };
  assert.equal(filtered.total, 0);
});

test("get_crawl_issues returns an audit issue page and validates the site scope", async (t) => {
  const { store, projectId, siteId } = await seed(t);
  const tools = createSeoMcpTools(store);
  const page = (await callTool(tools, "get_crawl_issues", { projectId, siteId, status: "open", severity: "high" })) as {
    data: Array<{ id: string; rule: string }>;
    total: number;
  };

  assert.equal(page.total, 1);
  assert.equal(page.data[0].rule, "missing_title");

  await assert.rejects(async () => await callTool(tools, "get_crawl_issues", { projectId, siteId: "site-nope" }), (error: unknown) => error instanceof ToolError && error.code === "unknown_site");
});

test("explain_opportunity returns the full record with evidence and resolved anchor", async (t) => {
  const { store, opportunity } = await seed(t);
  const tools = createSeoMcpTools(store);
  const explained = (await callTool(tools, "explain_opportunity", { opportunityId: opportunity.id })) as {
    opportunity: { id: string };
    evidence: unknown[];
    currentState: string;
    recommendedAction: string;
    priority: number;
    validationMetric: string;
  };

  assert.equal(explained.opportunity.id, opportunity.id);
  assert.equal(explained.evidence.length, 3);
  assert.equal(explained.validationMetric, "indexable");
  assert.ok(explained.recommendedAction.length > 0);
  assert.ok(explained.priority > 0);

  await assert.rejects(async () => await callTool(tools, "explain_opportunity", { opportunityId: "opp-missing" }), (error: unknown) => error instanceof ToolError && error.code === "unknown_opportunity");
});

test("callTool rejects unknown tool names and missing required args", async (t) => {
  const { store, projectId } = await seed(t);
  const tools = createSeoMcpTools(store);

  assert.throws(() => callTool(tools, "not_a_tool", {}), (error: unknown) => error instanceof ToolError && error.code === "unknown_tool");
  await assert.rejects(async () => await callTool(tools, "get_project_summary", {}), (error: unknown) => error instanceof ToolError && error.code === "missing_field");
  void projectId;
});

// ── Backlink / Authority tools ──────────────────────────────────────────────

interface BacklinkSeeded {
  store: BackendStore;
  projectId: string;
}

async function seedBacklinks(t: TestContext): Promise<BacklinkSeeded> {
  const store = await createStore("sqlite::memory:");
  t.after(async () => { await store.close(); });
  const project = await store.createProject({ name: "Backlink Test", slug: `bl-test-${Math.random().toString(36).slice(2)}` });
  await store.createSite(project.id, { baseUrl: "https://bl.example", scopeType: "domain", businessValue: 50 });
  // Two imports to record two snapshots (a meaningful diff once a provider is connected). With no
  // links provider connected, each import records an honest-empty snapshot (no backlinks).
  await store.importBacklinks(project.id);
  await store.importBacklinks(project.id);
  return { store, projectId: project.id };
}

test("get_authority_summary reports the honest-empty authority contract without a connected provider", async (t) => {
  const { store, projectId } = await seedBacklinks(t);
  const tools = createSeoMcpTools(store);
  const summary = (await callTool(tools, "get_authority_summary", { projectId })) as {
    totalBacklinks: number;
    referringDomains: number;
    followRatio: number;
  };

  // No links provider is connected, so the import records a snapshot with zero backlinks
  // (honest-empty state) rather than fabricated stub data.
  assert.equal(summary.totalBacklinks, 0, "totalBacklinks should be 0 with no connected provider");
  assert.equal(summary.referringDomains, 0, "referringDomains should be 0 with no connected provider");
  assert.ok(typeof summary.followRatio === "number", "followRatio should be a number");
});

test("list_referring_domains returns an empty array without a connected provider", async (t) => {
  const { store, projectId } = await seedBacklinks(t);
  const tools = createSeoMcpTools(store);
  const domains = (await callTool(tools, "list_referring_domains", { projectId })) as Array<{ domain: string; backlinks: number }>;

  assert.ok(Array.isArray(domains), "result should be an array");
  // Honest-empty state: an import without a connected links provider yields no referring domains.
  assert.equal(domains.length, 0, "should have no referring domains with no connected provider");
});

test("get_backlink_changes returns newReferringDomains and lostReferringDomains arrays", async (t) => {
  const { store, projectId } = await seedBacklinks(t);
  const tools = createSeoMcpTools(store);
  const diff = (await callTool(tools, "get_backlink_changes", { projectId })) as {
    newReferringDomains: string[];
    lostReferringDomains: string[];
    newBacklinks: unknown[];
    lostBacklinks: unknown[];
    netBacklinkChange: number;
    netReferringDomainChange: number;
  };

  assert.ok(Array.isArray(diff.newReferringDomains), "newReferringDomains should be an array");
  assert.ok(Array.isArray(diff.lostReferringDomains), "lostReferringDomains should be an array");
  assert.ok(Array.isArray(diff.newBacklinks), "newBacklinks should be an array");
  assert.ok(Array.isArray(diff.lostBacklinks), "lostBacklinks should be an array");
  assert.ok(typeof diff.netBacklinkChange === "number", "netBacklinkChange should be a number");
  assert.ok(typeof diff.netReferringDomainChange === "number", "netReferringDomainChange should be a number");
});

test("get_backlink_changes throws no_snapshots for a project with no imports", async (t) => {
  const store = await createStore("sqlite::memory:");
  t.after(async () => { await store.close(); });
  const project = await store.createProject({ name: "Empty Project", slug: `empty-${Math.random().toString(36).slice(2)}` });
  await store.createSite(project.id, { baseUrl: "https://empty.example", scopeType: "domain", businessValue: 50 });
  const tools = createSeoMcpTools(store);

  await assert.rejects(
    async () => await callTool(tools, "get_backlink_changes", { projectId: project.id }),
    (error: unknown) => error instanceof ToolError && error.code === "no_snapshots"
  );
});

// ── Report / Alert tools ────────────────────────────────────────────────────

test("get_latest_report returns the most recent report after generation", async (t) => {
  const { store, projectId } = await seed(t);
  const tools = createSeoMcpTools(store);

  // Before any report is generated, the result should be null.
  const empty = (await callTool(tools, "get_latest_report", { projectId })) as { report: null };
  assert.equal(empty.report, null);

  // Generate a report, then the tool should return it.
  await store.generateReport(projectId, "weekly_summary");
  const result = (await callTool(tools, "get_latest_report", { projectId })) as { report: { id: string; type: string } };
  assert.ok(result.report !== null, "report should be present after generation");
  assert.equal(result.report.type, "weekly_summary");
});

test("list_alert_events returns >= 1 event after rule creation and evaluation", async (t) => {
  const { store, projectId } = await seed(t);
  const tools = createSeoMcpTools(store);

  // Before any rule is created, the list should be empty.
  const before = (await callTool(tools, "list_alert_events", { projectId })) as unknown[];
  assert.ok(Array.isArray(before), "result should be an array");
  assert.equal(before.length, 0);

  // Create a rule that will always trigger (open_opportunities >= 0).
  await store.createAlertRule(projectId, { metric: "open_opportunities", comparator: "gte", threshold: 0 });
  await store.evaluateAlerts(projectId);

  const events = (await callTool(tools, "list_alert_events", { projectId })) as Array<{ id: string; triggered: boolean; metric: string }>;
  assert.ok(Array.isArray(events), "result should be an array");
  assert.ok(events.length >= 1, "should have at least one alert event after evaluation");
  assert.equal(events[0].metric, "open_opportunities");
  assert.equal(events[0].triggered, true);
});

// ── AI Visibility / Proposal tools (M6) ────────────────────────────────────

test("get_ai_visibility returns numeric prompts and score after snapshot recorded", async (t) => {
  const { store, projectId, siteId } = await seed(t);
  const tools = createSeoMcpTools(store);

  // Seed a prompt and record a snapshot so the score is meaningful.
  const aiPrompt = await store.createAiPrompt(projectId, { prompt: "best widget shop" });
  await store.recordAiSnapshot(projectId, aiPrompt.id);

  const score = (await callTool(tools, "get_ai_visibility", { projectId })) as {
    prompts: number;
    citedPrompts: number;
    brandMentions: number;
    score: number;
  };

  assert.ok(typeof score.prompts === "number", "prompts should be a number");
  assert.ok(typeof score.score === "number", "score should be a number");
  assert.ok(score.prompts >= 1, "prompts should be >= 1 after seeding");
  assert.ok(score.score >= 0 && score.score <= 100, "score should be 0-100");

  void siteId;
});

test("create_dev_ticket returns a proposed dev_ticket; propose_fix_pr returns fix_pr; list_proposals returns both", async (t) => {
  const { store, projectId } = await seed(t);
  const tools = createSeoMcpTools(store);

  // create_dev_ticket
  const ticket = (await callTool(tools, "create_dev_ticket", {
    projectId,
    title: "Fix missing title tags",
    body: "The product template is missing <title> elements. Add unique titles to every product page."
  })) as { id: string; kind: string; status: string; source: string };

  assert.equal(ticket.status, "proposed", "dev ticket should be in proposed status");
  assert.equal(ticket.kind, "dev_ticket", "kind should be dev_ticket");
  assert.equal(ticket.source, "mcp", "source should be mcp");

  // propose_fix_pr
  const pr = (await callTool(tools, "propose_fix_pr", {
    projectId,
    title: "Add title tags to product template",
    body: "PR to insert unique <title> tags into the product template component."
  })) as { id: string; kind: string; status: string; source: string };

  assert.equal(pr.status, "proposed", "fix PR should be in proposed status");
  assert.equal(pr.kind, "fix_pr", "kind should be fix_pr");
  assert.equal(pr.source, "mcp", "source should be mcp");

  // list_proposals should return >= 2 entries
  const proposals = (await callTool(tools, "list_proposals", { projectId })) as Array<{ id: string; kind: string }>;
  assert.ok(Array.isArray(proposals), "proposals should be an array");
  assert.ok(proposals.length >= 2, "should have at least 2 proposals after creating ticket and PR");

  const kinds = proposals.map((p) => p.kind);
  assert.ok(kinds.includes("dev_ticket"), "proposals should include dev_ticket");
  assert.ok(kinds.includes("fix_pr"), "proposals should include fix_pr");
});
