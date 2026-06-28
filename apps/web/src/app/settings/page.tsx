import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { StatusList } from "../../components/status-list";
import { loadFoundationDashboardData } from "../../lib/foundation-api";
import { createConnectorAction, createSourceMapEntryAction, evaluatePrCheckAction, scheduleConnectorSyncAction } from "./actions";

export const dynamic = "force-dynamic";

const connectorProviders = [
  { provider: "gsc", label: "Google Search Console", confidence: "B", description: "Klicks, Impressionen, Positionen und Index-Status direkt aus Google." },
  { provider: "ga4", label: "Google Analytics 4", confidence: "A", description: "Nutzungs-, Landingpage- und Conversion-Daten für den Geschäftswert." }
] as const;

const sovereigntyItems = [
  { id: "self-hostable-core", label: "Selbst hostbar — kein Zwang zu externer Infrastruktur", status: "ready", statusClassName: "status succeeded" },
  { id: "provider-abstraction", label: "Provider-Abstraktion statt Lock-in", status: "ready", statusClassName: "status succeeded" },
  { id: "data-portability", label: "Raw/Normalized Data getrennt", status: "guardrail", statusClassName: "status queued" },
  { id: "license-review", label: "Dependency-/License-Review vor Produktion", status: "todo", statusClassName: "status blocked" }
];

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadFoundationDashboardData();
  const selectedProject = data.selectedProject;
  const feedback = feedbackMessage(params);
  const connectorItems = data.integrations.length > 0
    ? data.integrations.map((integration) => ({
      id: integration.id,
      label: `${providerLabel(integration.provider)} · ${connectorStatusLabel(integration.status)}`,
      status: integration.status,
      statusClassName: `status ${integration.status}`
    }))
    : [{ id: "connector-empty", label: "Noch keine Datenquelle verbunden", status: "empty", statusClassName: "status blocked" }];
  const connectorJobs = data.jobs.filter((job) => job.type === "connector_sync");
  const jobItems = connectorJobs.length > 0
    ? connectorJobs.map((job) => ({
      id: job.id,
      label: `${providerLabel(job.subject)} — Datenabgleich`,
      status: job.status,
      statusClassName: `status ${job.status}`
    }))
    : [{ id: "job-empty", label: "Noch kein Datenabgleich geplant", status: "empty", statusClassName: "status blocked" }];

  return (
    <AppShell activePath="/settings">
      <section className="card hero-card">
        <p className="kicker">Einstellungen · Datenquellen</p>
        <h1>Datenquellen verbinden</h1>
        <p>
          Verbinden Sie Google Search Console und Google Analytics 4 mit Ihrem Projekt — danach fließen
          echte Klicks, Rankings und Nutzungsdaten in Ihre Analysen ein.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.integrations.filter((i) => i.status === "connected").length} verbundene Datenquellen</span>
          <span className="badge">{connectorJobs.length} geplante Abgleiche</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <OfflineNotice /> : null}
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Datenquelle verbinden</p>
          <p className="muted">Melden Sie sich mit Google an, um echte Klicks, Rankings und Positionen aus der Search Console einfließen zu lassen.</p>
          <div className="connector-grid">
            {connectorProviders.map((connector) => {
              const existing = data.integrations.find((integration) => integration.provider === connector.provider && integration.projectId === selectedProject?.id);
              const isConnected = existing?.status === "connected";
              return (
                <article className="connector-card" key={connector.provider}>
                  <div>
                    <span className="badge primary">{connector.provider.toUpperCase()}</span>
                    <h2>{connector.label}</h2>
                    <p>{connector.description}</p>
                  </div>
                  {connector.provider === "gsc" ? (
                    // Real Google OAuth: a GET redirect to the consent flow (not a server action).
                    selectedProject && data.connected ? (
                      <a className="button" href={`/api/oauth/google/authorize?projectId=${encodeURIComponent(selectedProject.id)}`}>
                        {isConnected ? "Neu verbinden" : "Mit Google verbinden"}
                      </a>
                    ) : (
                      <button className="button" type="button" disabled>
                        Mit Google verbinden
                      </button>
                    )
                  ) : (
                    <form action={createConnectorAction}>
                      <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
                      <input type="hidden" name="provider" value={connector.provider} />
                      <button className="button" type="submit" disabled={!data.connected || !selectedProject || Boolean(existing)}>
                        {existing ? "Verbindung vorhanden" : "Verbindung anlegen"}
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        </div>
        <div className="card">
          <p className="kicker">Verbundene Datenquellen</p>
          <StatusList items={connectorItems} />
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Datenabgleich planen</p>
          <p className="muted">Holt regelmäßig neue Daten von der verbundenen Quelle, damit Rankings und Kennzahlen aktuell bleiben.</p>
          <div className="connector-grid compact">
            {connectorProviders.map((connector) => {
              const existing = data.integrations.find((integration) => integration.provider === connector.provider && integration.projectId === selectedProject?.id);
              return (
                <form className="form-card" action={scheduleConnectorSyncAction} key={connector.provider}>
                  <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
                  <input type="hidden" name="provider" value={connector.provider} />
                  <strong>{connector.label}</strong>
                  <span>Plant einen täglichen Datenabgleich für {connector.label}.</span>
                  <button className="button secondary" type="submit" disabled={!data.connected || !selectedProject || !existing}>
                    Abgleich planen
                  </button>
                </form>
              );
            })}
          </div>
        </div>
        <div className="card">
          <p className="kicker">Status der Abgleiche</p>
          <StatusList items={jobItems} />
        </div>
      </section>

      {/* Developer / advanced tooling — separated from the everyday data-source flow above. */}
      <details className="advanced-section">
        <summary>
          <span className="advanced-section__title">Für Entwickler (erweitert)</span>
          <span className="advanced-section__hint">Quellcode-Verknüpfung, CI-Prüfung und Betriebs-Guardrails — für die Grundnutzung nicht nötig.</span>
        </summary>

        <section className="content-grid">
          <div className="card">
            <p className="kicker">Quellcode-Verknüpfung</p>
            <h2>URL → Template → Repo</h2>
            <p className="muted">Ordnet URLs ihrem Quellcode zu — ein Fix am Template korrigiert alle betroffenen Seiten gleichzeitig. Nur relevant, wenn das eigene Repo angebunden ist.</p>
            <form className="form-card" action={createSourceMapEntryAction}>
              <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
              <label>URL-Pattern<input name="urlPattern" placeholder="https://example.com/pricing" required /></label>
              <label>Repo-URL<input name="repoUrl" placeholder="https://github.com/acme/site" required /></label>
              <label>Template<input name="templateName" placeholder="PricingPage" required /></label>
              <label>Component<input name="component" placeholder="Pricing" required /></label>
              <label>Repo-Pfad<input name="repoPath" placeholder="apps/web/app/pricing/page.tsx" required /></label>
              <button className="button" type="submit" disabled={!data.connected || !selectedProject}>Mapping speichern</button>
            </form>
          </div>
          <div className="card">
            <p className="kicker">Aktuelle Quellcode-Zuordnungen</p>
            {data.sourceMap.length > 0 ? (
              <div className="table-list">
                {data.sourceMap.map((entry) => (
                  <article key={entry.id}>
                    <strong>{entry.urlPattern}</strong>
                    <div className="facts">
                      <span className="fact"><span className="fact__label">Vorlage</span><span className="fact__value">{entry.template}</span></span>
                      <span className="fact"><span className="fact__label">Datei</span><span className="fact__value">{entry.repoPath}</span></span>
                      <span className="fact"><span className="fact__label">Konfidenz</span><span className="fact__value">{entry.confidence}</span></span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>Noch keine Zuordnungen. Lege oben eine URL→Repo-Zuordnung an.</p>
            )}
          </div>
          <div className="card">
            <p className="kicker">CI-Prüfung vor dem Deployment</p>
            <h2>Geänderte Repo-Pfade prüfen</h2>
            <p className="muted">Löst geänderte Dateien über die Quellcode-Verknüpfung auf betroffene Templates und URLs auf und verknüpft offene Optimierungschancen. Als CI-Check vor dem Deployment einsetzbar.</p>
            <form className="form-card" action={evaluatePrCheckAction}>
              <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
              <label>Geänderte Pfade (einer pro Zeile)<textarea name="changedPaths" rows={4} placeholder={"src/templates/pricing.tsx\napps/web/app/pricing/page.tsx"} required /></label>
              <button className="button" type="submit" disabled={!data.connected || !selectedProject}>Prüfung auswerten</button>
            </form>
          </div>
        </section>

        <section className="content-grid">
          <div className="card">
            <p className="kicker">Betrieb &amp; Souveränität</p>
            <h2>Open-source-first</h2>
            <p>
              Query-Land bleibt selbst hostbar, speichert operative Daten lokal portabel und kapselt externe Dienste hinter austauschbaren Provider-Adaptern — kein Vendor-Lock-in.
            </p>
            <div className="badge-row">
              <span className="badge">Security &amp; Privacy</span>
              <span className="badge">No lock-in</span>
            </div>
          </div>
          <div className="card">
            <p className="kicker">Betriebs-Checkliste</p>
            <StatusList items={sovereigntyItems} />
          </div>
        </section>
      </details>
    </AppShell>
  );
}

function providerLabel(provider: string): string {
  const key = provider.toLowerCase();
  if (key === "gsc") return "Google Search Console";
  if (key === "ga4") return "Google Analytics 4";
  return provider.toUpperCase();
}

function connectorStatusLabel(status: string): string {
  if (status === "pending") return "bereit zum Verbinden";
  if (status === "connected") return "verbunden";
  if (status === "degraded") return "eingeschränkt";
  if (status === "error") return "Fehler — bitte neu verbinden";
  return status;
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const errorValue = single(params?.error);
  if (errorValue) return { kind: "danger", message: errorValue };
  const connectedValue = single(params?.connected);
  if (connectedValue) return { kind: "success", message: `${providerLabel(connectedValue)} ist verbunden. Echte Klick-, Ranking- und Positionsdaten fließen ab jetzt ein.` };
  const prcheck = single(params?.prcheck);
  if (prcheck) {
    const templates = single(params?.prtemplates) ?? "0";
    const opps = single(params?.propps) ?? "0";
    const kind = prcheck === "review_required" ? "danger" : "success";
    return { kind, message: `CI-Prüfung: ${prcheck} · ${templates} betroffene Templates · ${opps} verknüpfte Optimierungschancen.` };
  }
  const sourcemapValue = single(params?.sourcemap);
  if (sourcemapValue) return { kind: "success", message: "Quellcode-Zuordnung wurde gespeichert." };
  const createdValue = single(params?.created);
  if (createdValue) return { kind: "success", message: `${providerLabel(createdValue)} wurde verbunden.` };
  const scheduledValue = single(params?.scheduled);
  if (scheduledValue) return { kind: "success", message: `Datenabgleich für ${providerLabel(scheduledValue)} wurde geplant.` };
  return null;
}
