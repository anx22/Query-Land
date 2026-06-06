export type ModuleRouteStatus = "active" | "planned";

export interface ModuleRoute {
  path: string;
  label: string;
  icon: string;
  description: string;
  status: ModuleRouteStatus;
  plannedWave: number;
}

export const moduleRoutes = [
  { label: "Overview", path: "/", icon: "dashboard", description: "Projekt-KPIs, Risiken und nächste Maßnahmen", status: "active", plannedWave: 1 },
  { label: "Projects", path: "/projects", icon: "folder", description: "Scopes, Märkte, Wettbewerber und Business-Werte", status: "active", plannedWave: 1 },
  { label: "Technical Audit", path: "/technical-audit", icon: "troubleshoot", description: "Crawls, Issues, Health Score und URL Explorer", status: "active", plannedWave: 2 },
  { label: "URL Dossier", path: "/url-dossier", icon: "description", description: "Eine URL als vollständiges SEO-Objekt mit Source-Anker", status: "active", plannedWave: 2 },
  { label: "Keywords & Rank", path: "/keywords-rank", icon: "key", description: "Keyword-Sets, Rankings, SERP-Diffs und Visibility", status: "active", plannedWave: 3 },
  { label: "Content & Opportunities", path: "/content-opportunities", icon: "lightbulb", description: "Opportunity Board, Briefings und Validierung", status: "planned", plannedWave: 4 },
  { label: "Backlinks", path: "/backlinks", icon: "link", description: "Ref-Domains, Link-Events und Authority Delta", status: "planned", plannedWave: 5 },
  { label: "Reports", path: "/reports", icon: "description", description: "Weekly Pulse, Alerts und Exporte", status: "planned", plannedWave: 6 },
  { label: "AI Visibility", path: "/ai-visibility", icon: "auto_awesome", description: "Prompt-, Citation-, Mention- und Referral-Tracking", status: "planned", plannedWave: 7 },
  { label: "Settings", path: "/settings", icon: "settings", description: "Rollen, Connectors, Quotas und Observability", status: "active", plannedWave: 1 }
] as const satisfies readonly ModuleRoute[];

export type ModulePath = (typeof moduleRoutes)[number]["path"];

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
