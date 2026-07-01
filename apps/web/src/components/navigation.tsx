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
        <h1 className="brand-title">
          Query<span className="brand-title__accent">-</span>Land<span className="brand-title__accent">.</span>
        </h1>
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
                      {route.tier === "advanced" && route.dataStatus === "live" && !locked && (
                        <span className="nav-item__tier" title="Fortgeschrittene Funktion">
                          Erweitert
                        </span>
                      )}
                      {/* No padlock icon: a column of locks reads as a broken/disabled app on first
                          run. Locked items stay visible but muted (.is-locked) with the reason on
                          hover (title) + for screen readers, so the state is still communicated. */}
                      {locked && (
                        <span id={`${route.path}-lock`} className="visually-hidden">
                          Noch gesperrt: {lockReason}
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
