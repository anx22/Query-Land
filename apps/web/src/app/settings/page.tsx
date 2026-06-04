import { AppShell } from "../../components/app-shell";
import { StatusList } from "../../components/status-list";
import { loadFoundationDashboardData } from "../../lib/foundation-api";
import { createConnectorAction, scheduleConnectorSyncAction } from "./actions";

export const dynamic = "force-dynamic";

const connectorProviders = [
  { provider: "gsc", label: "Google Search Console", confidence: "B", description: "Stub für Search-Performance, Index Coverage und URL Inspection." },
  { provider: "ga4", label: "Google Analytics 4", confidence: "A", description: "Stub für Engagement-, Landingpage- und Conversion-Kontext." }
] as const;

const sovereigntyItems = [
  { id: "self-hostable-core", label: "Self-hostable Foundation Core", status: "ready", statusClassName: "status succeeded" },
  { id: "provider-abstraction", label: "Provider-Abstraktion statt Lock-in", status: "ready", statusClassName: "status succeeded" },
  { id: "data-portability", label: "Raw/Normalized Data getrennt", status: "guardrail", statusClassName: "status queued" },
  { id: "license-review", label: "Dependency-/License-Review vor Produktion", status: "todo", statusClassName: "status blocked" }
];

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadFoundationDashboardData();
  const selectedProject = data.selectedProject;
  const feedback = feedbackMessage(params?.created, params?.scheduled, params?.error);
  const connectorItems = data.integrations.length > 0
    ? data.integrations.map((integration) => ({
      id: integration.id,
      label: `${integration.provider.toUpperCase()} · Confidence ${integration.sourceConfidence}`,
      status: integration.status,
      statusClassName: `status ${integration.status}`
    }))
    : [{ id: "connector-empty", label: "Noch keine Connector-Stubs", status: "empty", statusClassName: "status blocked" }];
  const connectorJobs = data.jobs.filter((job) => job.type === "connector_sync");
  const jobItems = connectorJobs.length > 0
    ? connectorJobs.map((job) => ({
      id: job.id,
      label: `${job.type} · ${job.idempotencyKey ?? job.projectId}`,
      status: job.status,
      statusClassName: `status ${job.status}`
    }))
    : [{ id: "job-empty", label: "Noch kein Connector-Sync geplant", status: "empty", statusClassName: "status blocked" }];

  return (
    <AppShell activePath="/settings">
      <section className="card hero-card">
        <p className="kicker">Settings · Connectors</p>
        <h1>GSC/GA4 Connector-Stubs & Sync Jobs</h1>
        <p>
          Sprint-Fortschritt für Welle 1: Connector-Stubs können aus der UI für ein echtes SQLite-Projekt angelegt werden. Danach plant die UI idempotente `connector_sync` Jobs in der bestehenden Queue.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.integrations.length} Connectoren</span>
          <span className="badge">{connectorJobs.length} Connector Jobs</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Connector-Stubs erstellen</p>
          <div className="connector-grid">
            {connectorProviders.map((connector) => {
              const existing = data.integrations.find((integration) => integration.provider === connector.provider && integration.projectId === selectedProject?.id);
              return (
                <article className="connector-card" key={connector.provider}>
                  <div>
                    <span className="badge primary">{connector.provider.toUpperCase()}</span>
                    <h2>{connector.label}</h2>
                    <p>{connector.description}</p>
                    <span className="badge">Source Confidence {connector.confidence}</span>
                  </div>
                  <form action={createConnectorAction}>
                    <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
                    <input type="hidden" name="provider" value={connector.provider} />
                    <button className="button" type="submit" disabled={!data.connected || !selectedProject || Boolean(existing)}>
                      {existing ? "Stub vorhanden" : "Stub anlegen"}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </div>
        <div className="card">
          <p className="kicker">Aktuelle Connectoren</p>
          <StatusList items={connectorItems} />
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Sync-Job planen</p>
          <div className="connector-grid compact">
            {connectorProviders.map((connector) => {
              const existing = data.integrations.find((integration) => integration.provider === connector.provider && integration.projectId === selectedProject?.id);
              return (
                <form className="form-card" action={scheduleConnectorSyncAction} key={connector.provider}>
                  <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
                  <input type="hidden" name="provider" value={connector.provider} />
                  <strong>{connector.label}</strong>
                  <span>Plant `connector_sync` für Subject `{connector.provider}`.</span>
                  <button className="button secondary" type="submit" disabled={!data.connected || !selectedProject || !existing}>
                    Sync-Job planen
                  </button>
                </form>
              );
            })}
          </div>
        </div>
        <div className="card">
          <p className="kicker">Connector Job Monitor</p>
          <StatusList items={jobItems} />
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Open Source &amp; Souveränität</p>
          <h2>Open-source-first Guardrails</h2>
          <p>
            Der Foundation Core bleibt selbst hostbar, speichert operative Daten lokal portabel und kapselt externe Dienste hinter austauschbaren Provider-Adaptern. Damit wird Souveränität zum Sprint-Kriterium statt zum späteren Einkaufsrisiko.
          </p>
          <div className="badge-row">
            <span className="badge primary">DEC-005</span>
            <span className="badge">Security &amp; Privacy</span>
            <span className="badge">No lock-in</span>
          </div>
        </div>
        <div className="card">
          <p className="kicker">Readiness Check</p>
          <StatusList items={sovereigntyItems} />
        </div>
      </section>
    </AppShell>
  );
}

function feedbackMessage(created: string | string[] | undefined, scheduled: string | string[] | undefined, error: string | string[] | undefined): { kind: "success" | "danger"; message: string } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  if (errorValue) return { kind: "danger", message: errorValue };
  const createdValue = Array.isArray(created) ? created[0] : created;
  if (createdValue) return { kind: "success", message: `${createdValue.toUpperCase()} Connector-Stub wurde gespeichert.` };
  const scheduledValue = Array.isArray(scheduled) ? scheduled[0] : scheduled;
  if (scheduledValue) return { kind: "success", message: `${scheduledValue.toUpperCase()} Sync-Job wurde geplant.` };
  return null;
}
