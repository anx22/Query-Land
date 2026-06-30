import "../../features/technical-audit/audit.css";

/**
 * Route-level loading UI for /technical-audit. Shown as the Suspense fallback
 * while the server component awaits the audit overview loader. Pure skeleton —
 * no data, no client JS.
 */
export default function Loading() {
  return (
    <div className="audit-skeleton" aria-busy="true" aria-live="polite">
      <span className="audit-skeleton__sr">Technische Prüfung wird geladen …</span>

      <section className="card">
        <div className="audit-skeleton__line audit-skeleton__line--kicker" />
        <div className="audit-skeleton__line audit-skeleton__line--title" />
        <div className="audit-skeleton__line" />
      </section>

      <section className="audit-overview-grid">
        <div className="card">
          <div className="audit-skeleton__line audit-skeleton__line--kicker" />
          <div className="audit-skeleton__block" />
        </div>
        <div className="card">
          <div className="audit-skeleton__line audit-skeleton__line--kicker" />
          <div className="audit-skeleton__block" />
        </div>
      </section>

      <section className="card">
        <div className="audit-skeleton__line audit-skeleton__line--kicker" />
        <div className="audit-skeleton__block" />
      </section>

      <section className="card">
        <div className="audit-skeleton__line audit-skeleton__line--kicker" />
        <div className="audit-skeleton__line" />
        <div className="audit-skeleton__line" />
        <div className="audit-skeleton__line" />
      </section>
    </div>
  );
}
