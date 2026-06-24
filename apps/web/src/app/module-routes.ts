import type { IconName } from "../components/icon";

export type ModuleRouteStatus = "active" | "planned";

/** Navigation grouping — conveys the natural order/priority of the product. */
export type ModuleSection = "Start" | "Analyse" | "Wachstum" | "Erweitert" | "System";

/** Skill level hint for newcomers: prio-first vs. advanced. */
export type ModuleTier = "basic" | "advanced";

export interface ModuleRoute {
  path: string;
  label: string;
  icon: IconName;
  description: string;
  status: ModuleRouteStatus;
  plannedWave: number;
  section: ModuleSection;
  tier: ModuleTier;
}

export const moduleRoutes = [
  { label: "Übersicht", path: "/", icon: "dashboard", description: "Sichtbarkeit, Health Score und offene Optimierungschancen auf einen Blick.", status: "active", plannedWave: 1, section: "Start", tier: "basic" },
  { label: "Projekte", path: "/projects", icon: "folder", description: "Projekte, Sites, Märkte und Business-Werte verwalten.", status: "active", plannedWave: 1, section: "Start", tier: "basic" },
  { label: "Technical Audit", path: "/technical-audit", icon: "troubleshoot", description: "Technische SEO-Analyse — Crawl-Runs, Health Score, Indexierbarkeit und offene Issues.", status: "active", plannedWave: 2, section: "Analyse", tier: "basic" },
  { label: "URL-Dossier", path: "/url-dossier", icon: "description", description: "Eine URL als vollständiges SEO-Objekt: Crawl-Status, Indexierbarkeit, Rankings und Backlinks.", status: "active", plannedWave: 2, section: "Analyse", tier: "advanced" },
  { label: "Keywords & Rankings", path: "/keywords-rank", icon: "key", description: "Kuratiertes Keyword-Universum mit Rankings, Sichtbarkeit und SERP-Analyse.", status: "active", plannedWave: 3, section: "Analyse", tier: "basic" },
  { label: "Content & Chancen", path: "/content-opportunities", icon: "lightbulb", description: "Priorisierte Optimierungschancen mit Evidenz, Maßnahmen und Validierung.", status: "active", plannedWave: 4, section: "Wachstum", tier: "basic" },
  { label: "Backlinks", path: "/backlinks", icon: "link", description: "Verweisende Domains, Link-Aufbau und Authority-Entwicklung im Zeitverlauf.", status: "active", plannedWave: 5, section: "Wachstum", tier: "advanced" },
  { label: "Reports", path: "/reports", icon: "description", description: "Regelmäßige Berichte, automatische Lieferungen und Schwellwert-Alarme.", status: "active", plannedWave: 6, section: "Wachstum", tier: "advanced" },
  { label: "KI-Sichtbarkeit", path: "/ai-visibility", icon: "auto_awesome", description: "Ob die eigene Domain in KI-Antworten zitiert wird — Prompts, Citations und AEO-Bewertung.", status: "active", plannedWave: 7, section: "Erweitert", tier: "advanced" },
  { label: "Einstellungen", path: "/settings", icon: "settings", description: "Connectors, Datenquellen und Projekt-Konfiguration.", status: "active", plannedWave: 1, section: "System", tier: "basic" }
] as const satisfies readonly ModuleRoute[];

export type ModulePath = (typeof moduleRoutes)[number]["path"];

/** Sections in display order. */
export const MODULE_SECTIONS: ModuleSection[] = ["Start", "Analyse", "Wachstum", "Erweitert", "System"];

export function findModuleRoute(path: ModulePath): ModuleRoute {
  const route = moduleRoutes.find((item) => item.path === path);
  if (!route) {
    throw new Error(`Unknown module route: ${path}`);
  }
  return route;
}

export function moduleRouteHref(route: ModuleRoute): string {
  return route.path;
}
