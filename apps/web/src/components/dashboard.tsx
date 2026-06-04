import { appRoutes, demoOpportunities, seoMemory } from "@seo-tool/shared-config";
import type { FoundationDashboardData } from "../lib/foundation-api";
import { MetricCard } from "./metric-card";
import { StatusList } from "./status-list";

const activeOpportunity = demoOpportunities[0];

export function Dashboard({ data }: { data: FoundationDashboardData }) {
  const selectedProject = data.selectedProject;
  const dashboardMetrics = [
    { label: "Projects", value: String(data.projects.length), note: data.connected ? "aus /projects" : "API offline" },
    { label: "Sites", value: String(data.sites.length), note: selectedProject ? `Scope für ${selectedProject.slug}` : "kein Projekt gewählt" },
    { label: "Jobs", value: String(data.jobs.length), note: "aus /jobs" },
    { label: "Source Anchors", value: String(data.sourceMap.length), note: "aus /source-map" }
  ];

  const foundationGateItems = seoMemory.foundationGate.map((item) => ({
    id: item,
    label: item,
    status: gateStatus(item, data),
    statusClassName: `status ${gateStatusClass(item, data)}`
  }));

  const connectorItems = data.integrations.length > 0
    ? data.integrations.map((integration) => ({
      id: integration.id,
      label: integration.provider.toUpperCase(),
      status: integration.status,
      statusClassName: `status ${integration.status}`
    }))
    : [{ id: "no-integrations", label: "Keine Connectoren", status: "empty", statusClassName: "status blocked" }];

  const jobItems = data.jobs.length > 0
    ? data.jobs.map((job) => ({
      id: job.id,
      label: job.type,
      status: job.status,
      statusClassName: `status ${job.status}`
    }))
    : [{ id: "no-jobs", label: "Keine Jobs", status: "empty", statusClassName: "status blocked" }];

  return (
    <>
      <section className="hero-grid">
        <div className="card hero-card">
          <p className="kicker">Internal SEO OS</p>
          <h1>Foundation Console für echte SEO-Operations</h1>
          <p>
            Diese Übersicht liest den Foundation-State aus der lokalen API/SQLite-Schicht. Demo-Fixtures sind hier nicht mehr die Datenquelle für Projekte, Sites, Connectoren, Jobs und Source-Map.
          </p>
          <div className="badge-row">
            <span className="badge primary">Wave 1</span>
            <span className="badge">Evidence-first</span>
            <span className="badge">SQLite API</span>
            <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
          </div>
          <div className="action-row">
            <a className="button" href="/projects">Projekt anlegen</a>
            <a className="button secondary" href="/technical-audit">Crawl starten</a>
            <a className="button secondary" href="/settings">GSC/GA4 verbinden</a>
          </div>
          {!data.connected ? (
            <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p>
          ) : null}
        </div>
        <div className="card">
          <p className="kicker">Foundation Gate</p>
          <h2>{selectedProject?.name ?? "Noch kein Projekt"}</h2>
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
          <p className="kicker">Sites aus SQLite/API</p>
          {data.sites.length > 0 ? (
            <div className="table-list">
              {data.sites.map((site) => (
                <article key={site.id}>
                  <strong>{site.baseUrl}</strong>
                  <span>{site.scopeType} · {site.crawlFrequency} · Business Value {site.businessValue}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>Keine Site für das aktuelle Projekt vorhanden. Lege im nächsten Sprint-Step Projekt-/Site-Formulare an.</p>
          )}
        </div>
        <div className="card">
          <p className="kicker">Connectors</p>
          <StatusList items={connectorItems} />
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Source Map</p>
          {data.sourceMap.length > 0 ? (
            <div className="table-list">
              {data.sourceMap.map((entry) => (
                <article key={entry.id}>
                  <strong>{entry.urlPattern} → {entry.component}</strong>
                  <span>{entry.repoPath} · {entry.confidence}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>Keine Source-Map-Einträge vorhanden.</p>
          )}
        </div>
        <div className="card">
          <p className="kicker">Job Monitor</p>
          <StatusList items={jobItems} />
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
          <p className="kicker">Nächste Opportunity</p>
          <h2>{activeOpportunity.recommendedAction}</h2>
          <p>{activeOpportunity.currentState}</p>
          <div className="badge-row">
            <span className="badge primary">noch Demo-Modul</span>
            <span className="badge">Evidenz {activeOpportunity.evidence[0]?.sourceConfidence}</span>
            <span className="badge">{activeOpportunity.validationMetric}</span>
          </div>
        </div>
      </section>
    </>
  );
}

function gateStatus(item: string, data: FoundationDashboardData): string {
  if (!data.connected) return "offline";
  if (item === "Domain anlegen") return data.projects.length > 0 && data.sites.length > 0 ? "bereit" : "empty";
  if (item === "GSC/GA4 verbinden") return data.integrations.length > 0 ? "stub" : "empty";
  if (item === "Fehler und Jobs sichtbar machen") return data.jobs.length > 0 ? "sichtbar" : "empty";
  return "nächster Schritt";
}

function gateStatusClass(item: string, data: FoundationDashboardData): string {
  const status = gateStatus(item, data);
  if (["bereit", "stub", "sichtbar"].includes(status)) return "succeeded";
  if (status === "offline" || status === "empty") return "blocked";
  return "queued";
}
