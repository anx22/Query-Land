import { appRoutes, demoIntegrations, demoJobs, demoOpportunities, demoProject, demoSourceMap, seoMemory } from "@seo-tool/shared-config";
import { InfoCard } from "./info-card.js";
import { StatusList } from "./status-list.js";

const moduleStats = [
  { label: "Projekt", value: demoProject.name },
  { label: "Connectors", value: String(demoIntegrations.length) },
  { label: "Jobs", value: String(demoJobs.length) }
];

const sourceMapItems = demoSourceMap.map((mapping) => ({
  id: mapping.id,
  label: mapping.routePattern,
  status: mapping.confidence,
  statusClassName: "badge primary"
}));

export function ModulePage({ href }: { href: string }) {
  const route = appRoutes.find((item) => item.href === href) ?? appRoutes[0];
  const isFoundation = route.wave === 1;
  const primaryOpportunity = demoOpportunities[0];

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
            {moduleStats.map((stat) => (
              <InfoCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
        <div className="card">
          <p className="kicker">Source Map</p>
          <StatusList items={sourceMapItems} />
        </div>
      </section>

      <section className="card">
        <p className="kicker">Evidence-first Beispiel</p>
        <h2>{primaryOpportunity.recommendedAction}</h2>
        <p>{primaryOpportunity.validationMetric}</p>
        <div className="badge-row">
          <span className="badge primary">Priority {primaryOpportunity.priority}</span>
          <span className="badge">Source {primaryOpportunity.evidence[0]?.source}</span>
          <span className="badge">Anchor {primaryOpportunity.sourceAnchor?.templateName}</span>
        </div>
      </section>
    </>
  );
}
