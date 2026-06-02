const foundationCards = [
  { title: "Auth", value: "Backend Login", detail: "E-Mail/Passwort-Sessions werden serverseitig gehasht und in SQLite gespeichert." },
  { title: "Projects", value: "Project + Site Scope", detail: "Domains, Märkte und Business-Wert als Kontext für alle Module." },
  { title: "Integrations", value: "GSC + GA4 vorbereitet", detail: "Connector-Verträge trennen Raw- und Normalized-Daten mit Confidence-Klassen." },
  { title: "Jobs", value: "SQLite Queue", detail: "Idempotente Foundation-Jobs für Sync, Crawl Seeds, Source Map und Health Checks." },
  { title: "Source Map", value: "URL → Code", detail: "Erster Anker von URL-Mustern zu Templates und Repo-Pfaden." }
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Sprint 0 · Welle 1 Foundation</p>
        <h1>Internal SEO OS Foundation</h1>
        <p>
          Lauffähiger Startpunkt für die sprintweise Entwicklung: Next.js UI, TypeScript API,
          embedded SQLite-Backend, Login-Sessions, Job-Gerüst, Fixtures und die ersten API-Flächen
          für Project Control, Integrations, Source Map und Observability.
        </p>
      </section>
      <section className="grid" aria-label="Foundation Bereiche">
        {foundationCards.map((card) => (
          <article className="card" key={card.title}>
            <span>{card.title}</span>
            <h2>{card.value}</h2>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
