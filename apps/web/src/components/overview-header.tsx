/**
 * OverviewHeader (O-1) — editorial page header for the Overview screen.
 *
 * Composition per the approved mockup: a serif hero claim with the topographic
 * "Ridges" contour band (brand/header/ridges/ridges-band-01) as a subtle, masked
 * full-bleed illustration behind it. Source asset confirmed with the user;
 * served from /brand/overview-header.jpg.
 *
 * Serious-Zone (Teil 1 §1): the metaphor lives only in this hero frame — never
 * in the numbers/status below.
 */
export function OverviewHeader({
  projectName,
  hasData = true,
}: {
  projectName: string | null;
  /** Result controls (Zeitraum/Export) are meaningless before any analysis exists — hide them. */
  hasData?: boolean;
}) {
  return (
    <header className="overview-header">
      <div className="overview-header__art" aria-hidden="true" />
      {hasData ? (
        <div className="overview-header__controls">
          <span className="overview-header__period">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" />
            </svg>
            Zeitraum
          </span>
          <a className="overview-header__export" href="/reports">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            Export
          </a>
        </div>
      ) : null}
      <div className="overview-header__inner">
        <p className="kicker">Übersicht · {projectName ?? "Kein Projekt"}</p>
        <h1 className="overview-header__title">
          Sichtbarkeit, die sich{" "}
          <span className="overview-header__accent">belegen</span> lässt
        </h1>
        <p className="overview-header__lead">
          Datengetrieben. Evidenzbasiert. Für Entscheidungen, die Wirkung zeigen.
        </p>
      </div>
    </header>
  );
}
