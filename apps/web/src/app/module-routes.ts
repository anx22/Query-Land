import type { IconName } from "../components/icon";

export type ModuleRouteStatus = "active" | "planned";

/** Navigation grouping — conveys the natural order/priority of the product. */
export type ModuleSection = "Start" | "Analyse" | "Wachstum" | "Erweitert" | "System";

/** Skill level hint for newcomers: prio-first vs. advanced. */
export type ModuleTier = "basic" | "advanced";

/**
 * Honesty signal about the data a module shows:
 *   live        — real engine; shows real data or an honest empty state (no demo placeholders)
 *   coming-soon — module not yet active (reserved; none currently)
 */
export type ModuleDataStatus = "live" | "coming-soon";

export interface ModuleRoute {
  path: string;
  label: string;
  icon: IconName;
  description: string;
  status: ModuleRouteStatus;
  plannedWave: number;
  section: ModuleSection;
  tier: ModuleTier;
  dataStatus: ModuleDataStatus;
}

export const moduleRoutes = [
  { label: "Projekte", path: "/projects", icon: "folder", description: "Projekte, Sites, Märkte und Business-Werte verwalten.", status: "active", plannedWave: 1, section: "Start", tier: "basic", dataStatus: "live" },
  { label: "Übersicht", path: "/", icon: "dashboard", description: "Sichtbarkeit, Health Score und offene Optimierungschancen auf einen Blick.", status: "active", plannedWave: 1, section: "Start", tier: "basic", dataStatus: "live" },
  { label: "Technical Audit", path: "/technical-audit", icon: "troubleshoot", description: "Technische SEO-Analyse — Crawl-Runs, Health Score, Indexierbarkeit und offene Issues.", status: "active", plannedWave: 2, section: "Analyse", tier: "basic", dataStatus: "live" },
  { label: "URL-Dossier", path: "/url-dossier", icon: "description", description: "Eine URL als vollständiges SEO-Objekt: Crawl-Status, Indexierbarkeit, Rankings und Backlinks.", status: "active", plannedWave: 2, section: "Analyse", tier: "advanced", dataStatus: "live" },
  { label: "Keywords & Rankings", path: "/keywords-rank", icon: "key", description: "Kuratiertes Keyword-Universum mit Rankings, Sichtbarkeit und SERP-Analyse.", status: "active", plannedWave: 3, section: "Analyse", tier: "basic", dataStatus: "live" },
  { label: "Content & Chancen", path: "/content-opportunities", icon: "lightbulb", description: "Priorisierte Optimierungschancen mit Evidenz, Maßnahmen und Validierung.", status: "active", plannedWave: 4, section: "Wachstum", tier: "basic", dataStatus: "live" },
  { label: "Content Workspace", path: "/content-workspace", icon: "description", description: "Refresh-Kandidaten, Content-Score und manuell editierbare Content-Briefs mit Ticket-/PR-Übergabe.", status: "active", plannedWave: 4, section: "Wachstum", tier: "basic", dataStatus: "live" },
  { label: "Backlinks", path: "/backlinks", icon: "link", description: "Verweisende Domains, Link-Aufbau und Authority-Entwicklung im Zeitverlauf.", status: "active", plannedWave: 5, section: "Wachstum", tier: "advanced", dataStatus: "live" },
  { label: "Reports", path: "/reports", icon: "description", description: "Regelmäßige Berichte, automatische Lieferungen und Schwellwert-Alarme.", status: "active", plannedWave: 6, section: "Wachstum", tier: "advanced", dataStatus: "live" },
  { label: "KI-Sichtbarkeit", path: "/ai-visibility", icon: "auto_awesome", description: "Ob die eigene Domain in KI-Antworten zitiert wird — Prompts, Citations und AEO-Bewertung.", status: "active", plannedWave: 7, section: "Erweitert", tier: "advanced", dataStatus: "live" },
  { label: "Einstellungen", path: "/settings", icon: "settings", description: "Connectors, Datenquellen und Projekt-Konfiguration.", status: "active", plannedWave: 1, section: "System", tier: "basic", dataStatus: "live" }
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
