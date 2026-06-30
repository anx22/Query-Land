/**
 * context-bar.tsx — global "you are here" indicator in the topbar.
 *
 * Server component. One website = one project, so this shows a SINGLE crumb: the
 * active website (its address). That keeps the active scope unambiguous app-wide
 * without restating a redundant "project › site" pair. When no website exists yet,
 * it points straight at website creation.
 */

export interface ContextBarProps {
  projectName: string | null;
  siteBaseUrl: string | null;
}

export function ContextBar({ projectName, siteBaseUrl }: ContextBarProps) {
  if (!projectName) {
    return (
      <nav className="context-bar" aria-label="Aktive Website">
        <a className="context-bar__empty" href="/projects">
          Keine Website — zuerst hinzufügen
        </a>
      </nav>
    );
  }

  return (
    <nav className="context-bar" aria-label="Aktive Website">
      <span className="context-bar__crumb context-bar__project">{siteBaseUrl ?? projectName}</span>
    </nav>
  );
}
