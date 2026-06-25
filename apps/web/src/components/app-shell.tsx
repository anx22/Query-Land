import { Navigation } from "./navigation";
import { ReadinessBanner } from "./readiness-banner";
import { OnboardingChecklist } from "./onboarding-checklist";
import { ContextBar } from "./context-bar";
import { SiteSwitcher } from "./site-switcher";
import { DataStatusBanner } from "./data-status-banner";
import { loadFoundationDashboardData } from "../lib/foundation-api";
import { computeReadiness, firstUnmet } from "../lib/readiness";
import { moduleRoutes, type ModuleRoute } from "../app/module-routes";

export async function AppShell({
  activePath,
  children,
}: {
  activePath: string;
  children: React.ReactNode;
}) {
  const foundation = await loadFoundationDashboardData();
  const readiness = computeReadiness({
    projects: foundation.projects,
    selectedProject: foundation.selectedProject,
    sites: foundation.sites,
    integrations: foundation.integrations,
    jobs: foundation.jobs,
  });
  const unmet = firstUnmet(activePath, readiness);
  const activeRoute: ModuleRoute | null = moduleRoutes.find((route) => route.path === activePath) ?? null;

  return (
    <div className="shell">
      <Navigation
        activePath={activePath}
        projects={foundation.projects.map((project) => ({ id: project.id, name: project.name }))}
        activeProjectId={foundation.selectedProject?.id ?? null}
        readiness={readiness}
      />
      <main className="main">
        <header className="topbar">
          <ContextBar
            projectName={foundation.selectedProject?.name ?? null}
            siteBaseUrl={foundation.selectedSite?.baseUrl ?? null}
          />
          <div className="topbar__controls">
            <SiteSwitcher
              sites={foundation.sites.map((site) => ({ id: site.id, baseUrl: site.baseUrl }))}
              activeSiteId={foundation.selectedSite?.id ?? null}
            />
            <a className="badge" href="/login">Anmelden</a>
          </div>
        </header>
        {activePath === "/" && <OnboardingChecklist readiness={readiness} />}
        <ReadinessBanner unmet={unmet} />
        {activeRoute ? <DataStatusBanner status={activeRoute.dataStatus} note={activeRoute.dataNote} /> : null}
        {children}
      </main>
    </div>
  );
}
