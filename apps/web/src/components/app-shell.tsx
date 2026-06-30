import { cookies } from "next/headers";
import { Navigation } from "./navigation";
import { ReadinessBanner } from "./readiness-banner";
import { OnboardingChecklist } from "./onboarding-checklist";
import { ContextBar } from "./context-bar";
import { DataStatusBanner } from "./data-status-banner";
import { loadFoundationDashboardData } from "../lib/foundation-api";
import { resolveLocalSession, webSessionCookieName } from "../lib/auth-api";
import { computeReadiness, firstUnmet } from "../lib/readiness";
import { moduleRoutes, type ModuleRoute } from "../app/module-routes";
import { logoutAction } from "../app/login/actions";

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
  const currentUser = await safeResolveSession();

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
          {/* The "you are here" crumb is meaningless on the login screen — and showing
              "Keine Website — zuerst hinzufügen" there contradicts the actual next step (sign in). */}
          {activePath === "/login" ? (
            <span />
          ) : (
            <ContextBar
              projectName={foundation.selectedProject?.name ?? null}
              siteBaseUrl={foundation.selectedSite?.baseUrl ?? null}
            />
          )}
          <div className="topbar__controls">
            {currentUser ? (
              <form action={logoutAction} className="cluster">
                <span className="badge success" title={currentUser.email}>{currentUser.name}</span>
                <button className="button secondary compact" type="submit">Abmelden</button>
              </form>
            ) : activePath === "/login" ? null : (
              // A real control, not a status pill — and never shown on the login page itself.
              <a className="button secondary compact" href="/login">Anmelden</a>
            )}
          </div>
        </header>
        {activePath === "/" && <OnboardingChecklist readiness={readiness} />}
        <ReadinessBanner unmet={unmet} />
        {activeRoute ? <DataStatusBanner status={activeRoute.dataStatus} /> : null}
        {children}
      </main>
    </div>
  );
}

/** Resolve the logged-in user for the top bar; never throw — a session hiccup must not break the shell. */
async function safeResolveSession() {
  try {
    const token = (await cookies()).get(webSessionCookieName)?.value;
    return await resolveLocalSession(token);
  } catch {
    return null;
  }
}
