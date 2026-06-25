/**
 * readiness.ts — pure, API-free waterfall/dependency logic for the whole app.
 *
 * The product has a strict setup order ("Wasserfall"): a project must exist
 * before a site can be added, a site before a crawl, a data source before
 * keyword/content/backlink analysis, etc. The UI reflects this:
 *   - locked nav items get an inactive color treatment (still navigable),
 *   - gated pages render a prominent ReadinessBanner explaining the next step,
 *   - final action buttons whose data prerequisites are unmet are DISABLED
 *     (not clickable) with a reason — see `actionLock()`.
 *
 * This module imports no API client and no node built-ins, so it is safe to use
 * from client islands and is unit-testable in isolation.
 */

import type {
  FoundationProject,
  FoundationSite,
  FoundationIntegration,
  FoundationJob,
} from "./foundation-api";

/** One rung of the setup waterfall. */
export type Prerequisite = "project" | "site" | "integration" | "crawl";

export interface ReadinessInput {
  projects: FoundationProject[];
  selectedProject: FoundationProject | null;
  sites: FoundationSite[];
  integrations: FoundationIntegration[];
  jobs: FoundationJob[];
}

export interface ReadinessState {
  hasProject: boolean;
  hasSite: boolean;
  hasIntegration: boolean;
  hasCrawl: boolean;
}

/**
 * Derive the readiness booleans from raw foundation data.
 * Integrations/jobs are scoped to the selected project when one is set.
 */
export function computeReadiness(input: ReadinessInput): ReadinessState {
  const projectId = input.selectedProject?.id ?? null;

  const hasProject = input.projects.length > 0;
  const hasSite = input.sites.length > 0;

  // A connector stub for the project counts as "data source connected" — real
  // OAuth is a backend GAP; creating the connector is the user-facing step.
  const hasIntegration = input.integrations.some(
    (integration) => projectId === null || integration.projectId === projectId,
  );

  // A crawl_seed job existing for the project means a crawl was kicked off.
  const hasCrawl = input.jobs.some(
    (job) =>
      job.type === "crawl_seed" && (projectId === null || job.projectId === projectId),
  );

  return { hasProject, hasSite, hasIntegration, hasCrawl };
}

/** Is a single prerequisite satisfied by the current state? */
export function isMet(prerequisite: Prerequisite, state: ReadinessState): boolean {
  switch (prerequisite) {
    case "project":
      return state.hasProject;
    case "site":
      return state.hasSite;
    case "integration":
      return state.hasIntegration;
    case "crawl":
      return state.hasCrawl;
  }
}

/**
 * Ordered prerequisites per route. The banner/lock surfaces the FIRST unmet
 * one. Routes that are themselves part of the setup flow (overview, projects,
 * settings) have no prerequisites so they are always fully usable.
 */
export const ROUTE_PREREQUISITES: Record<string, Prerequisite[]> = {
  "/": [],
  "/projects": [],
  "/settings": ["project"],
  "/technical-audit": ["project", "site"],
  "/url-dossier": ["project", "site", "crawl"],
  "/keywords-rank": ["project", "integration"],
  "/content-opportunities": ["project", "site", "integration"],
  "/content-workspace": ["project", "site"],
  "/backlinks": ["project", "integration"],
  "/reports": ["project", "integration"],
  "/ai-visibility": ["project", "site"],
};

/** First unmet prerequisite for a route, or null when the route is unlocked. */
export function firstUnmet(path: string, state: ReadinessState): Prerequisite | null {
  const requirements = ROUTE_PREREQUISITES[path] ?? [];
  for (const requirement of requirements) {
    if (!isMet(requirement, state)) {
      return requirement;
    }
  }
  return null;
}

/** A route is locked when it has at least one unmet prerequisite. */
export function isRouteLocked(path: string, state: ReadinessState): boolean {
  return firstUnmet(path, state) !== null;
}

export interface PrerequisiteMeta {
  /** Short noun used inline ("Projekt fehlt"). */
  label: string;
  /** Full banner sentence explaining the gate. */
  banner: string;
  /** Tooltip/disabled-reason for locked actions. */
  reason: string;
  ctaLabel: string;
  ctaHref: string;
}

export const PREREQUISITE_META: Record<Prerequisite, PrerequisiteMeta> = {
  project: {
    label: "Projekt",
    banner:
      "Noch kein Projekt angelegt. Ein Projekt ist die Klammer über allen Analysen — lege zuerst eines an.",
    reason: "Zuerst ein Projekt anlegen.",
    ctaLabel: "Projekt anlegen",
    ctaHref: "/projects",
  },
  site: {
    label: "Site",
    banner:
      "Dieses Projekt hat noch keine Site/URL. Füge eine Site hinzu, damit Crawls und URL-Analysen möglich werden.",
    reason: "Zuerst eine Site/URL zum Projekt hinzufügen.",
    ctaLabel: "Site hinzufügen",
    ctaHref: "/projects",
  },
  integration: {
    label: "Datenquelle",
    banner:
      "Noch keine Datenquelle verbunden. Verbinde die Google Search Console, damit Keyword-, Content- und Backlink-Daten einfließen.",
    reason: "Zuerst eine Datenquelle (Google Search Console) verbinden.",
    ctaLabel: "Datenquelle verbinden",
    ctaHref: "/settings",
  },
  crawl: {
    label: "Crawl",
    banner:
      "Noch kein Crawl gestartet. Starte einen Crawl im Technical Audit, um technische Daten und URLs zu sammeln.",
    reason: "Zuerst einen Crawl im Technical Audit starten.",
    ctaLabel: "Crawl starten",
    ctaHref: "/technical-audit#crawl-start",
  },
};

export interface OnboardingStep {
  prerequisite: Prerequisite;
  title: string;
  description: string;
  done: boolean;
  ctaLabel: string;
  ctaHref: string;
}

/** Build the four-step onboarding waterfall with per-step done state. */
export function onboardingSteps(state: ReadinessState): OnboardingStep[] {
  const order: Array<{ prerequisite: Prerequisite; title: string; description: string }> = [
    {
      prerequisite: "project",
      title: "Projekt anlegen",
      description: "Lege ein Projekt als Klammer über Sites, Märkte und Business-Werte an.",
    },
    {
      prerequisite: "site",
      title: "Site / URL hinzufügen",
      description: "Verknüpfe die Domain oder den URL-Scope, der analysiert werden soll.",
    },
    {
      prerequisite: "integration",
      title: "Datenquelle verbinden",
      description: "Verbinde die Google Search Console für Rankings, Klicks und Impressions.",
    },
    {
      prerequisite: "crawl",
      title: "Ersten Crawl starten",
      description: "Starte einen Crawl, um technische Gesundheit, Issues und URLs zu erfassen.",
    },
  ];

  return order.map((step) => {
    const meta = PREREQUISITE_META[step.prerequisite];
    return {
      prerequisite: step.prerequisite,
      title: step.title,
      description: step.description,
      done: isMet(step.prerequisite, state),
      ctaLabel: meta.ctaLabel,
      ctaHref: meta.ctaHref,
    };
  });
}

/** Index of the first incomplete step (for "current" highlighting); -1 = done. */
export function currentStepIndex(steps: OnboardingStep[]): number {
  return steps.findIndex((step) => !step.done);
}

/** True when every waterfall step is complete. */
export function isFullySetUp(state: ReadinessState): boolean {
  return state.hasProject && state.hasSite && state.hasIntegration && state.hasCrawl;
}

export interface ActionLock {
  locked: boolean;
  /** Human reason, suitable for a tooltip/title and inline hint. */
  reason: string | null;
}

/**
 * Decide whether a final action button must be disabled. Pass the prerequisites
 * that the action's data depends on; the first unmet one provides the reason.
 *
 * Example: the "Crawl starten" button needs a site →
 *   actionLock(state, ["project", "site"])
 */
export function actionLock(state: ReadinessState, requires: Prerequisite[]): ActionLock {
  for (const requirement of requires) {
    if (!isMet(requirement, state)) {
      return { locked: true, reason: PREREQUISITE_META[requirement].reason };
    }
  }
  return { locked: false, reason: null };
}
