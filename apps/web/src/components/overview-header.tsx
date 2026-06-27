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
export function OverviewHeader({ projectName }: { projectName: string | null }) {
  return (
    <header className="overview-header">
      <div className="overview-header__art" aria-hidden="true" />
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
