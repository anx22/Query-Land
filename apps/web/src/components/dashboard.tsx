import { appRoutes, demoIntegrations, demoJobs, demoOpportunities, demoProject, demoSourceMap, seoMemory } from "@seo-tool/shared-config";
import { MetricCard } from "./metric-card.js";
import { StatusList } from "./status-list.js";

const activeOpportunity = demoOpportunities[0];
const dashboardMetrics = [
  { label: "Health Score", value: "82", note: "Crawler A-Daten" },
  { label: "Project Visibility", value: "14.8", note: "Keyword-Set basiert" },
  { label: "Opportunity Score", value: String(activeOpportunity.priority), note: "Impact × Confidence ÷ Effort" },
  { label: "Source Anchors", value: String(demoSourceMap.length), note: "Template-Mappings" }
];

const foundationGateItems = seoMemory.foundationGate.map((item) => ({
  id: item,
  label: item,
  status: "bereit",
  statusClassName: "status running"
}));

const connectorItems = demoIntegrations.map((integration) => ({
  id: integration.id,
  label: integration.displayName,
  status: integration.status,
  statusClassName: `status ${integration.status}`
}));

const jobItems = demoJobs.map((job) => ({
  id: job.id,
  label: job.kind,
  status: job.status,
  statusClassName: `status ${job.status}`
}));

export function Dashboard() {
  return (
    <>
      <section className="hero-grid">
        <div className="card hero-card">
          <p className="kicker">Internal SEO OS</p>
          <h1>Foundation Console für SEO-Operations</h1>
          <p>
            Master-Spec, UX-Flows, KPI-Definitionen und Child-Specs wurden in ein vertikal geschnittenes Monorepo übertragen. Diese Konsole zeigt den startklaren Foundation-Slice.
          </p>
          <div className="badge-row">
            <span className="badge primary">Wave 1</span>
            <span className="badge">Evidence-first</span>
            <span className="badge">SQLite ready</span>
            <span className="badge">API contracts</span>
          </div>
          <div className="action-row">
            <button className="button">Projekt anlegen</button>
            <button className="button secondary">Crawl starten</button>
            <button className="button secondary">GSC/GA4 verbinden</button>
          </div>
        </div>
        <div className="card">
          <p className="kicker">Foundation Gate</p>
          <h2>{demoProject.name}</h2>
          <StatusList items={foundationGateItems} />
        </div>
      </section>

      <section className="metric-grid">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} />
        ))}
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
          <StatusList items={connectorItems} />
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
          <StatusList items={jobItems} />
        </div>
      </section>
    </>
  );
}
