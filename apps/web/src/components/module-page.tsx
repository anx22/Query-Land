import { appRoutes, demoIntegrations, demoJobs, demoOpportunities, demoProject, demoSourceMap, seoMemory } from "@seo-tool/shared-config";

export function ModulePage({ href }: { href: string }) {
  const route = appRoutes.find((item) => item.href === href) ?? appRoutes[0];
  const isFoundation = route.wave === 1;

  return (
    <>
      <section className="card hero-card">
        <p className="kicker">{isFoundation ? "Foundation Scope" : `Geplante Delivery-Welle ${route.wave}`}</p>
        <h1>{route.label}</h1>
        <p>{route.description}</p>
        <div className="badge-row">
          {seoMemory.principles.slice(0, 4).map((principle) => (
            <span className="badge" key={principle}>{principle}</span>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">UI State</p>
          <h2>{isFoundation ? "Aktiv vorbereitet" : "Route vorbereitet, Modul folgt in späterer Welle"}</h2>
          <p>
            Die App legt die komplette UX-Navigation bereits an, hält aber nur Foundation-Daten produktiv aktiv. Spätere Module werden über dieselben Domain-Modelle, Jobs und Evidence-Regeln erweitert.
          </p>
          <div className="module-grid">
            <Info label="Projekt" value={demoProject.name} />
            <Info label="Connectors" value={String(demoIntegrations.length)} />
            <Info label="Jobs" value={String(demoJobs.length)} />
          </div>
        </div>
        <div className="card">
          <p className="kicker">Source Map</p>
          <ul className="status-list">
            {demoSourceMap.map((mapping) => (
              <li key={mapping.id}>
                <span>{mapping.routePattern}</span>
                <span className="badge primary">{mapping.confidence}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card">
        <p className="kicker">Evidence-first Beispiel</p>
        <h2>{demoOpportunities[0].recommendedAction}</h2>
        <p>{demoOpportunities[0].validationMetric}</p>
        <div className="badge-row">
          <span className="badge primary">Priority {demoOpportunities[0].priority}</span>
          <span className="badge">Source {demoOpportunities[0].evidence[0]?.source}</span>
          <span className="badge">Anchor {demoOpportunities[0].sourceAnchor?.templateName}</span>
        </div>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="kicker">{label}</p>
      <span className="metric-value">{value}</span>
    </div>
  );
}
