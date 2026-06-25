/**
 * context-bar.tsx — global "you are here" breadcrumb in the topbar.
 *
 * Server component. Shows the active project › site on every screen so the
 * crawl/audit scope is unambiguous app-wide (no more per-page badge repetition).
 * When no project exists yet, it points straight at project creation.
 */

export interface ContextBarProps {
  projectName: string | null;
  siteBaseUrl: string | null;
}

export function ContextBar({ projectName, siteBaseUrl }: ContextBarProps) {
  if (!projectName) {
    return (
      <nav className="context-bar" aria-label="Aktiver Kontext">
        <a className="context-bar__empty" href="/projects">
          Kein Projekt — zuerst anlegen
        </a>
      </nav>
    );
  }

  return (
    <nav className="context-bar" aria-label="Aktiver Kontext">
      <span className="context-bar__crumb context-bar__project">{projectName}</span>
      <span className="context-bar__sep" aria-hidden="true">
        ›
      </span>
      <span className="context-bar__crumb context-bar__site">
        {siteBaseUrl ?? "keine Site"}
      </span>
    </nav>
  );
}
