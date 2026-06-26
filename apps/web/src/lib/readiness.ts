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

  // "Connected" means a real, authenticated data source — DB status "connected" (set by the GSC
  // OAuth callback). A merely prepared (pending) connector does NOT count, so the optional
  // data-source boost step only flips to done once a real source is actually connected.
  const hasIntegration = input.integrations.some(
    (integration) =>
      integration.status === "connected" && (projectId === null || integration.projectId === projectId),
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
// Gates reflect REAL data dependencies only. A connected data source (GSC/GA4) is an optional
// booster, never a hard gate — so it does not appear here. The engines that need a crawl gate on
// it; keyword entry, backlinks (optional source) and reports only need a project.
export const ROUTE_PREREQUISITES: Record<string, Prerequisite[]> = {
  "/": [],
  "/projects": [],
  "/settings": ["project"],
  "/technical-audit": ["project", "site"],
  "/url-dossier": ["project", "site", "crawl"],
  "/keywords-rank": ["project"],
  "/content-opportunities": ["project", "site", "crawl"],
  "/backlinks": ["project"],
  "/reports": ["project"],
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
      "Legen Sie zuerst ein Projekt an — es klammert alle Auswertungen einer Website zusammen.",
    reason: "Zuerst ein Projekt anlegen.",
    ctaLabel: "Projekt anlegen",
    ctaHref: "/projects",
  },
  site: {
    label: "Website",
    banner:
      "Dieses Projekt hat noch keine Website. Tragen Sie die Adresse ein, damit die Analyse loslegen kann.",
    reason: "Zuerst eine Website zum Projekt hinzufügen.",
    ctaLabel: "Website hinzufügen",
    ctaHref: "/projects",
  },
  integration: {
    label: "Google Search Console",
    banner:
      "Optional: Verbinden Sie die Google Search Console, sobald verfügbar — das bringt echte Klick- und Ranking-Daten dazu.",
    reason: "Optional: Google Search Console verbinden.",
    ctaLabel: "Verbinden",
    ctaHref: "/settings",
  },
  crawl: {
    label: "Analyse",
    banner:
      "Starten Sie die erste Analyse — sie prüft die Website und liefert sofort technische Befunde und gefundene Seiten.",
    reason: "Zuerst die erste Analyse starten.",
    ctaLabel: "Analyse starten",
    ctaHref: "/technical-audit#crawl-start",
  },
};

export interface OnboardingStep {
  prerequisite: Prerequisite;
  title: string;
  description: string;
  done: boolean;
  /** Optional steps are a "boost", not required to finish setup (e.g. connect a data source). */
  optional: boolean;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Build the guided setup steps with per-step done state.
 *
 * Order follows the real value path: a crawl delivers technical findings immediately, so it comes
 * right after the site. Connecting a data source is an OPTIONAL boost (real Google login is a later
 * phase) and is surfaced last, never blocking completion.
 */
export function onboardingSteps(state: ReadinessState): OnboardingStep[] {
  const order: Array<{ prerequisite: Prerequisite; title: string; description: string; optional?: boolean }> = [
    {
      prerequisite: "project",
      title: "Projekt anlegen",
      description: "Geben Sie Ihrem Vorhaben einen Namen — das Projekt klammert alle Auswertungen einer Website.",
    },
    {
      prerequisite: "site",
      title: "Website hinzufügen",
      description: "Welche Website soll analysiert werden? Tragen Sie einfach die Adresse ein.",
    },
    {
      prerequisite: "crawl",
      title: "Erste Analyse starten",
      description: "Ein Klick prüft die Website und liefert sofort technische Befunde, Probleme und gefundene Seiten.",
    },
    {
      prerequisite: "integration",
      title: "Google Search Console verbinden",
      description: "Optional: Sobald verfügbar, bringt die Verbindung echte Klick- und Ranking-Daten dazu.",
      optional: true,
    },
  ];

  return order.map((step) => {
    const meta = PREREQUISITE_META[step.prerequisite];
    return {
      prerequisite: step.prerequisite,
      title: step.title,
      description: step.description,
      done: isMet(step.prerequisite, state),
      optional: step.optional ?? false,
      ctaLabel: meta.ctaLabel,
      ctaHref: meta.ctaHref,
    };
  });
}

/**
 * Index of the first incomplete REQUIRED step (for "current" highlighting); -1 when every required
 * step is done. Optional steps never become the highlighted "current" step.
 */
export function currentStepIndex(steps: OnboardingStep[]): number {
  return steps.findIndex((step) => !step.done && !step.optional);
}

/** True when every REQUIRED setup step is complete (an optional data source is not required). */
export function isFullySetUp(state: ReadinessState): boolean {
  return state.hasProject && state.hasSite && state.hasCrawl;
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
