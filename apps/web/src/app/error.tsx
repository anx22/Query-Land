"use client";

/**
 * Root error boundary. Catches unexpected render/data errors from any route and shows a calm,
 * human-readable fallback instead of a raw stack trace — with a one-click retry. Technical detail
 * (error.message / digest) stays in the console/server logs, never in front of the user.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-page">
      <section className="card">
        <p className="kicker">Fehler</p>
        <h1>Etwas ist schiefgelaufen</h1>
        <p>
          Beim Laden dieser Seite ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es
          erneut — wenn es weiterhin auftritt, laden Sie die Seite neu.
        </p>
        <div className="cluster">
          <button className="button" type="button" onClick={() => reset()}>
            Erneut versuchen
          </button>
          <a className="button secondary" href="/">
            Zur Übersicht
          </a>
        </div>
      </section>
    </main>
  );
}
