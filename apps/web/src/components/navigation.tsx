import Link from "next/link";
import { moduleRoutes, MODULE_SECTIONS, type ModuleSection } from "../app/module-routes";
import { Icon } from "./icon";
import { ProjectSwitcher, type ProjectSwitcherOption } from "./project-switcher";
import { firstUnmet, PREREQUISITE_META, type ReadinessState } from "../lib/readiness";

export interface NavigationProps {
  activePath: string;
  projects: ProjectSwitcherOption[];
  activeProjectId: string | null;
  readiness: ReadinessState;
}

export function Navigation({ activePath, projects, activeProjectId, readiness }: NavigationProps) {
  return (
    <aside className="sidebar">
      <div>
        <h1 className="brand-title">Query-Land</h1>
        <p className="brand-claim">Sichtbarkeit, die sich belegen lässt.</p>
      </div>

      <ProjectSwitcher projects={projects} activeProjectId={activeProjectId} />

      <nav className="nav" aria-label="Hauptnavigation">
        {MODULE_SECTIONS.map((section: ModuleSection) => {
          const routes = moduleRoutes.filter((route) => route.section === section);
          if (routes.length === 0) return null;
          return (
            <div key={section} className="nav-section">
              <p className="nav-section__label">{section}</p>
              <div className="nav-list">
                {routes.map((route) => {
                  const isActive = activePath === route.path;
                  const unmet = firstUnmet(route.path, readiness);
                  const locked = unmet !== null;
                  const lockReason = unmet ? PREREQUISITE_META[unmet].reason : undefined;
                  return (
                    <Link
                      key={route.path}
                      className={`nav-item${isActive ? " active" : ""}${locked ? " is-locked" : ""}`}
                      href={route.path}
                      title={lockReason}
                      aria-describedby={locked ? `${route.path}-lock` : undefined}
                    >
                      <span className="nav-icon" aria-hidden="true">
                        <Icon name={route.icon} />
                      </span>
                      <span className="nav-item__label">{route.label}</span>
                      {route.dataStatus !== "live" && !locked && (
                        <span
                          className="nav-item__data-tag"
                          title={
                            route.dataStatus === "demo"
                              ? "Demo-Daten — echte Datenquelle folgt"
                              : "Noch nicht aktiv"
                          }
                        >
                          {route.dataStatus === "demo" ? "Demo" : "Bald"}
                        </span>
                      )}
                      {route.tier === "advanced" && route.dataStatus === "live" && !locked && (
                        <span className="nav-item__tier" title="Fortgeschrittene Funktion">
                          Erweitert
                        </span>
                      )}
                      {locked && (
                        <span className="nav-item__lock" aria-hidden="true">
                          <Icon name="lock" />
                        </span>
                      )}
                      {locked && (
                        <span id={`${route.path}-lock`} className="visually-hidden">
                          Gesperrt: {lockReason}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
