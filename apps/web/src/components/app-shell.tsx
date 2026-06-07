import { Navigation } from "./navigation";
import { ReadinessBanner } from "./readiness-banner";
import { OnboardingChecklist } from "./onboarding-checklist";
import { loadFoundationDashboardData } from "../lib/foundation-api";
import { computeReadiness, firstUnmet } from "../lib/readiness";

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
          <input className="search" aria-label="Suche" placeholder="Domains, URLs, Chancen suchen…" />
          <div className="badge-row">
            <a className="badge" href="/login">Anmelden</a>
          </div>
        </header>
        {activePath === "/" && <OnboardingChecklist readiness={readiness} />}
        <ReadinessBanner unmet={unmet} />
        {children}
      </main>
    </div>
  );
}
