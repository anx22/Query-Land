import "../../features/content-workspace/workspace.css";

/**
 * Route-level loading UI for /content-workspace. Suspense fallback while the
 * server component awaits the workspace loader. Pure skeleton — no data, no JS.
 */
export default function Loading() {
  return (
    <div className="cw-skeleton" aria-busy="true" aria-live="polite">
      <span className="cw-skeleton__sr">Content Workspace wird geladen …</span>

      <section className="card">
        <div className="cw-skeleton__line cw-skeleton__line--kicker" />
        <div className="cw-skeleton__line cw-skeleton__line--title" />
        <div className="cw-skeleton__line" />
      </section>

      <div className="cw-grid">
        <section className="card">
          <div className="cw-skeleton__line cw-skeleton__line--kicker" />
          <div className="cw-skeleton__block" />
        </section>
        <section className="card">
          <div className="cw-skeleton__line cw-skeleton__line--kicker" />
          <div className="cw-skeleton__block" />
        </section>
      </div>

      <section className="card">
        <div className="cw-skeleton__line cw-skeleton__line--kicker" />
        <div className="cw-skeleton__line" />
        <div className="cw-skeleton__line" />
      </section>
    </div>
  );
}
