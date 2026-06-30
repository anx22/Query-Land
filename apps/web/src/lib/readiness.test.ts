import { describe, it, expect } from "vitest";
import {
  computeReadiness,
  firstUnmet,
  isRouteLocked,
  onboardingSteps,
  currentStepIndex,
  isFullySetUp,
  actionLock,
  type ReadinessInput,
} from "./readiness";

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    projects: [],
    selectedProject: null,
    sites: [],
    integrations: [],
    jobs: [],
    ...overrides,
  };
}

const project = { id: "p1", name: "Demo", slug: "demo", status: "active", defaultLocale: "de-DE" };
const otherProject = { ...project, id: "p2", slug: "other" };

describe("computeReadiness", () => {
  it("reports nothing ready for an empty input", () => {
    const state = computeReadiness(baseInput());
    expect(state).toEqual({
      hasProject: false,
      hasSite: false,
      hasIntegration: false,
      hasCrawl: false,
    });
  });

  it("detects project, site, integration and crawl", () => {
    const state = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        sites: [
          { id: "s1", projectId: "p1", baseUrl: "https://x", scopeType: "domain", crawlFrequency: "weekly", businessValue: 50 },
        ],
        integrations: [
          { id: "i1", projectId: "p1", provider: "gsc", status: "connected", sourceConfidence: "B", freshness: null },
        ],
        jobs: [
          { id: "j1", projectId: "p1", type: "crawl_seed", status: "queued", idempotencyKey: "k", subject: "s", payload: {}, attempts: 0, updatedAt: "" },
        ],
      }),
    );
    expect(state).toEqual({ hasProject: true, hasSite: true, hasIntegration: true, hasCrawl: true });
  });

  it("counts only a connected integration, not a pending stub", () => {
    const pending = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        integrations: [{ id: "i1", projectId: "p1", provider: "gsc", status: "pending", sourceConfidence: "B", freshness: null }],
      }),
    );
    expect(pending.hasIntegration).toBe(false);

    const active = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        integrations: [{ id: "i1", projectId: "p1", provider: "gsc", status: "connected", sourceConfidence: "B", freshness: null }],
      }),
    );
    expect(active.hasIntegration).toBe(true);
  });

  it("scopes integrations and crawl jobs to the selected project", () => {
    const state = computeReadiness(
      baseInput({
        projects: [project, otherProject],
        selectedProject: project,
        integrations: [
          { id: "i1", projectId: "p2", provider: "gsc", status: "connected", sourceConfidence: "B", freshness: null },
        ],
        jobs: [
          { id: "j1", projectId: "p2", type: "crawl_seed", status: "succeeded", idempotencyKey: "k", subject: "s", payload: {}, attempts: 0, updatedAt: "" },
        ],
      }),
    );
    expect(state.hasIntegration).toBe(false);
    expect(state.hasCrawl).toBe(false);
  });

  it("ignores non-crawl jobs", () => {
    const state = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        jobs: [
          { id: "j1", projectId: "p1", type: "connector_sync", status: "succeeded", idempotencyKey: "k", subject: "s", payload: {}, attempts: 0, updatedAt: "" },
        ],
      }),
    );
    expect(state.hasCrawl).toBe(false);
  });
});

describe("firstUnmet / isRouteLocked", () => {
  const empty = computeReadiness(baseInput());
  const ready = computeReadiness(
    baseInput({
      projects: [project],
      selectedProject: project,
      sites: [{ id: "s1", projectId: "p1", baseUrl: "https://x", scopeType: "domain", crawlFrequency: "weekly", businessValue: 50 }],
      integrations: [{ id: "i1", projectId: "p1", provider: "gsc", status: "connected", sourceConfidence: "B", freshness: null }],
      jobs: [{ id: "j1", projectId: "p1", type: "crawl_seed", status: "succeeded", idempotencyKey: "k", subject: "s", payload: {}, attempts: 0, updatedAt: "" }],
    }),
  );

  it("keeps the core setup routes always unlocked", () => {
    expect(isRouteLocked("/", empty)).toBe(false);
    expect(isRouteLocked("/projects", empty)).toBe(false);
  });

  it("gates settings until a project exists, then unlocks it", () => {
    expect(isRouteLocked("/settings", empty)).toBe(true);
    const withProject = computeReadiness(baseInput({ projects: [project], selectedProject: project }));
    expect(isRouteLocked("/settings", withProject)).toBe(false);
  });

  it("returns the first missing rung for a gated route", () => {
    expect(firstUnmet("/technical-audit", empty)).toBe("project");
    expect(firstUnmet("/url-dossier", empty)).toBe("project");
    expect(firstUnmet("/keywords-rank", empty)).toBe("project");
  });

  it("advances to the next rung once earlier ones are met", () => {
    const withProjectAndSite = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        sites: [{ id: "s1", projectId: "p1", baseUrl: "https://x", scopeType: "domain", crawlFrequency: "weekly", businessValue: 50 }],
      }),
    );
    expect(firstUnmet("/technical-audit", withProjectAndSite)).toBeNull();
    expect(firstUnmet("/url-dossier", withProjectAndSite)).toBe("crawl");
    // Content opportunities are generated from crawl data, so they gate on a crawl, not a source.
    expect(firstUnmet("/content-opportunities", withProjectAndSite)).toBe("crawl");
  });

  it("gates the data modules on a project only — a data source is never a hard gate", () => {
    const withProject = computeReadiness(baseInput({ projects: [project], selectedProject: project }));
    expect(firstUnmet("/keywords-rank", withProject)).toBeNull();
    expect(firstUnmet("/backlinks", withProject)).toBeNull();
    expect(firstUnmet("/reports", withProject)).toBeNull();
  });

  it("unlocks everything when fully set up", () => {
    for (const path of ["/technical-audit", "/url-dossier", "/keywords-rank", "/content-opportunities", "/backlinks", "/reports", "/ai-visibility"]) {
      expect(isRouteLocked(path, ready)).toBe(false);
    }
  });
});

describe("onboardingSteps", () => {
  it("marks done state per step in order", () => {
    const state = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        sites: [{ id: "s1", projectId: "p1", baseUrl: "https://x", scopeType: "domain", crawlFrequency: "weekly", businessValue: 50 }],
      }),
    );
    // One website = one project, so the steps are: website (done), analysis, optional source.
    const steps = onboardingSteps(state);
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(steps.map((s) => s.prerequisite)).toEqual(["site", "crawl", "integration"]);
    expect(currentStepIndex(steps)).toBe(1);
    expect(isFullySetUp(state)).toBe(false);
  });

  it("reports completion", () => {
    const ready = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        sites: [{ id: "s1", projectId: "p1", baseUrl: "https://x", scopeType: "domain", crawlFrequency: "weekly", businessValue: 50 }],
        integrations: [{ id: "i1", projectId: "p1", provider: "gsc", status: "connected", sourceConfidence: "B", freshness: null }],
        jobs: [{ id: "j1", projectId: "p1", type: "crawl_seed", status: "succeeded", idempotencyKey: "k", subject: "s", payload: {}, attempts: 0, updatedAt: "" }],
      }),
    );
    const steps = onboardingSteps(ready);
    expect(currentStepIndex(steps)).toBe(-1);
    expect(isFullySetUp(ready)).toBe(true);
  });
});

describe("actionLock", () => {
  const empty = computeReadiness(baseInput());
  const withProject = computeReadiness(baseInput({ projects: [project], selectedProject: project }));

  it("locks with the first unmet reason", () => {
    const lock = actionLock(empty, ["project", "site"]);
    expect(lock.locked).toBe(true);
    expect(lock.reason).toMatch(/Website/);
  });

  it("advances the reason as prerequisites are met", () => {
    const lock = actionLock(withProject, ["project", "site"]);
    expect(lock.locked).toBe(true);
    expect(lock.reason).toMatch(/Adresse/);
  });

  it("unlocks when all requirements are met", () => {
    const ready = computeReadiness(
      baseInput({
        projects: [project],
        selectedProject: project,
        sites: [{ id: "s1", projectId: "p1", baseUrl: "https://x", scopeType: "domain", crawlFrequency: "weekly", businessValue: 50 }],
      }),
    );
    const lock = actionLock(ready, ["project", "site"]);
    expect(lock.locked).toBe(false);
    expect(lock.reason).toBeNull();
  });
});
