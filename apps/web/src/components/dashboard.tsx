import { appRoutes, demoIntegrations, demoJobs, demoOpportunities, demoProject, demoSourceMap, seoMemory } from "@seo-tool/shared-config";

export function Dashboard() {
  const activeOpportunity = demoOpportunities[0];

  return (
    <>
      <section className="hero">
        <div className="card hero-card">
          <p className="kicker">Project Overview · Source of Truth</p>
          <h1>Ein entscheidungsfähiger SEO-Workflow statt isolierter Dashboards.</h1>
          <p>
            Diese Foundation verbindet Projekt-Scope, Connector-Status, Job-Monitoring, Source-Map-Gerüst und ein erstes evidence-first Opportunity-Objekt zu einem vertikalen Schnitt.
          </p>
          <div className="cta-row">
            <button className="button">Domain anlegen</button>
            <button className="button secondary">Crawl starten</button>
            <button className="button secondary">GSC/GA4 verbinden</button>
          </div>
        </div>
        <div className="card">
          <p className="kicker">Foundation Gate</p>
          <h2>{demoProject.name}</h2>
          <ul className="status-list">
            {seoMemory.foundationGate.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span className="status running">bereit</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="metric-grid">
        <Metric label="Health Score" value="82" note="Crawler A-Daten" />
        <Metric label="Project Visibility" value="14.8" note="Keyword-Set basiert" />
        <Metric label="Opportunity Score" value={String(activeOpportunity.priority)} note="Impact × Confidence ÷ Effort" />
        <Metric label="Source Anchors" value={String(demoSourceMap.length)} note="Template-Mappings" />
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Top Opportunity</p>
          <h2>{activeOpportunity.recommendedAction}</h2>
          <p>{activeOpportunity.currentState}</p>
          <div className="badge-row">
            <span className="badge primary">{activeOpportunity.status}</span>
            <span className="badge">Evidenz {activeOpportunity.evidence[0]?.sourceConfidence}</span>
            <span className="badge">{activeOpportunity.validationMetric}</span>
          </div>
        </div>
        <div className="card">
          <p className="kicker">Connectors</p>
          <ul className="status-list">
            {demoIntegrations.map((integration) => (
              <li key={integration.id}>
                <span>{integration.displayName}</span>
                <span className={`status ${integration.status}`}>{integration.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Routing Memory</p>
          <h2>Hauptnavigation aus UX-Flows</h2>
          <div className="module-grid">
            {appRoutes.map((route) => (
              <article key={route.href} className="card">
                <span className="badge primary">W{route.wave}</span>
                <h3>{route.label}</h3>
                <p>{route.description}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="kicker">Job Monitor</p>
          <ul className="status-list">
            {demoJobs.map((job) => (
              <li key={job.id}>
                <span>{job.kind}</span>
                <span className={`status ${job.status}`}>{job.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card">
      <p className="kicker">{label}</p>
      <span className="metric-value">{value}</span>
      <p>{note}</p>
    </div>
  );
}
