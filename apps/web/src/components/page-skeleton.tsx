/**
 * Generic route-level loading skeleton — pure CSS, no data, no client JS.
 *
 * Shown as the Suspense fallback while a server page awaits its loader. Per-route `loading.tsx`
 * files render this with a route-specific screen-reader label.
 */
export function PageSkeleton({ label = "Wird geladen …" }: { label?: string }) {
  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <span className="page-skeleton__sr">{label}</span>

      <section className="card">
        <div className="skeleton-line skeleton-line--kicker" />
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line" />
      </section>

      <section className="content-grid">
        <div className="card">
          <div className="skeleton-line skeleton-line--kicker" />
          <div className="skeleton-block" />
        </div>
        <div className="card">
          <div className="skeleton-line skeleton-line--kicker" />
          <div className="skeleton-block" />
        </div>
      </section>

      <section className="card">
        <div className="skeleton-line skeleton-line--kicker" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--half" />
      </section>
    </div>
  );
}
