import type { AlertComparator, AlertEvent, AlertMetric, AlertRule, DeliveryChannel, Report, ReportCadence, ReportSchedule, ReportType } from "@seo-tool/domain-model";
import { ALERT_COMPARATORS, ALERT_METRICS, DELIVERY_CHANNELS, REPORT_CADENCES, REPORT_TYPES } from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { loadReports } from "../../features/reports";
import {
  createAlertRuleAction,
  createScheduleAction,
  deliverReportAction,
  evaluateAlertsAction,
  generateReportAction,
  runDueAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadReports();
  const feedback = feedbackMessage(params);
  const triggeredEvents = data.alertEvents.filter((e) => e.triggered);

  return (
    <AppShell activePath="/reports">
      {/* Hero card */}
      <section className="card hero-card">
        <p className="kicker">Reporting &amp; Alerts</p>
        <h1>Reports &amp; Alarme</h1>
        <p>
          Generiere Snapshots der SEO-Daten (Health, Opportunities, Sichtbarkeit, Authority), plane automatische Lieferungen und setze Schwellwert-Alarme auf projektweite Kennzahlen.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
        <div className="action-row">
          <form action={generateReportAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <label>
              Report-Typ
              <select name="type" defaultValue="weekly_summary">
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{labelForReportType(t)}</option>
                ))}
              </select>
            </label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Wochenreport generieren</button>
          </form>
          <form action={runDueAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <button className="button secondary" type="submit" disabled={!data.connected || !data.selectedProject}>Fällige Reports ausführen</button>
          </form>
        </div>
      </section>

      {/* Metric grid */}
      <section className="metric-grid">
        <MetricCard label="Reports" value={String(data.reports.length)} note="generierte Snapshots" />
        <MetricCard label="Zeitpläne" value={String(data.schedules.length)} note="aktive Schedules" />
        <MetricCard label="Alert-Regeln" value={String(data.alertRules.length)} note="definierte Schwellwerte" />
        <MetricCard label="Ausgelöste Alerts" value={String(triggeredEvents.length)} note={`von ${data.alertEvents.length} ausgewerteten Events`} />
      </section>

      {/* Latest report */}
      <section className="card">
        <p className="kicker">Letzter Report</p>
        {data.latestReport ? (
          <>
            <h2>{data.latestReport.title}</h2>
            <div className="badge-row">
              <span className="badge">{labelForReportType(data.latestReport.type)}</span>
              <span className="badge">Generiert: {data.latestReport.generatedAt}</span>
            </div>
            {data.latestReport.sections.map((section) => (
              <div key={section.title}>
                <h3>{section.title}</h3>
                {section.rows.length > 0 ? (
                  <table className="data-table">
                    <tbody>
                      {section.rows.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{String(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">Keine Zeilen in dieser Sektion.</p>
                )}
              </div>
            ))}
            <div className="action-row">
              <a className="button secondary" href={`/api/export/reports/${data.latestReport.id}/export?format=csv`} target="_blank" rel="noopener noreferrer">CSV exportieren</a>
              <a className="button secondary" href={`/api/export/reports/${data.latestReport.id}/export?format=html`} target="_blank" rel="noopener noreferrer">HTML exportieren</a>
            </div>
            <div>
              <p className="kicker">Report versenden</p>
              <form action={deliverReportAction} className="inline-form">
                <input type="hidden" name="reportId" value={data.latestReport.id} />
                <label>
                  Kanal
                  <select name="channel" defaultValue="email">
                    {DELIVERY_CHANNELS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Ziel (E-Mail / Webhook)
                  <input type="text" name="target" placeholder="z. B. team@example.com" />
                </label>
                <button className="button" type="submit" disabled={!data.connected}>Versenden</button>
              </form>
            </div>
          </>
        ) : (
          <p>Noch kein Report vorhanden. Klicke „Wochenreport generieren", um den ersten Snapshot zu erstellen.</p>
        )}
      </section>

      {/* Reports history */}
      <section className="card">
        <p className="kicker">Report-Verlauf</p>
        {data.reports.length > 0 ? (
          <div className="table-list">
            {data.reports.map((report) => (
              <article key={report.id}>
                <strong>{report.title}</strong>
                <span className="badge">{labelForReportType(report.type)}</span>
                <span className="muted">{report.generatedAt}</span>
                <div className="inline-actions">
                  <a className="button secondary compact" href={`/api/export/reports/${report.id}/export?format=csv`} target="_blank" rel="noopener noreferrer">CSV</a>
                  <a className="button secondary compact" href={`/api/export/reports/${report.id}/export?format=html`} target="_blank" rel="noopener noreferrer">HTML</a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>Keine Reports vorhanden.</p>
        )}
      </section>

      <section className="content-grid">
        {/* Schedules card */}
        <div className="card">
          <p className="kicker">Zeitpläne</p>
          <h2>Schedule erstellen</h2>
          <form action={createScheduleAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <label>
              Report-Typ
              <select name="type" defaultValue="weekly_summary">
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{labelForReportType(t)}</option>
                ))}
              </select>
            </label>
            <label>
              Kadenz
              <select name="cadence" defaultValue="weekly">
                {REPORT_CADENCES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Lieferkanal (optional)
              <select name="channel">
                <option value="">— keiner —</option>
                {DELIVERY_CHANNELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Ziel (optional)
              <input type="text" name="target" placeholder="z. B. team@example.com" />
            </label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Schedule anlegen</button>
          </form>

          {data.schedules.length > 0 ? (
            <>
              <h3>Bestehende Zeitpläne</h3>
              <div className="table-list">
                {data.schedules.map((schedule) => (
                  <article key={schedule.id}>
                    <strong>{labelForReportType(schedule.type)}</strong>
                    <span className="badge">{schedule.cadence}</span>
                    {schedule.channel ? <span className="badge">{schedule.channel}</span> : null}
                    {schedule.target ? <span>{schedule.target}</span> : null}
                    <span className="muted">Letzter Lauf: {schedule.lastRunAt ?? "noch nie"}</span>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Noch keine Zeitpläne angelegt.</p>
          )}
        </div>

        {/* Alerts card */}
        <div className="card">
          <p className="kicker">Alert-Regeln</p>
          <h2>Regel erstellen</h2>
          <form action={createAlertRuleAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <label>
              Kennzahl
              <select name="metric" defaultValue="visibility_score">
                {ALERT_METRICS.map((m) => (
                  <option key={m} value={m}>{labelForMetric(m)}</option>
                ))}
              </select>
            </label>
            <label>
              Vergleich
              <select name="comparator" defaultValue="lt">
                {ALERT_COMPARATORS.map((c) => (
                  <option key={c} value={c}>{labelForComparator(c)}</option>
                ))}
              </select>
            </label>
            <label>
              Schwellwert
              <input type="number" name="threshold" step="any" placeholder="z. B. 50" required />
            </label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Regel anlegen</button>
          </form>

          <form action={evaluateAlertsAction} className="action-row">
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <button className="button secondary" type="submit" disabled={!data.connected || !data.selectedProject}>Alerts auswerten</button>
          </form>

          {data.alertRules.length > 0 ? (
            <>
              <h3>Definierte Regeln</h3>
              <div className="table-list">
                {data.alertRules.map((rule) => (
                  <article key={rule.id}>
                    <strong>{labelForMetric(rule.metric)}</strong>
                    <span className="badge">{labelForComparator(rule.comparator)} {rule.threshold}</span>
                    <span className="muted">angelegt: {rule.createdAt}</span>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Noch keine Alert-Regeln angelegt.</p>
          )}

          {data.alertEvents.length > 0 ? (
            <>
              <h3>Letzte Alert-Events</h3>
              <div className="table-list">
                {data.alertEvents.slice(0, 20).map((event) => (
                  <article key={event.id}>
                    <strong>{labelForMetric(event.metric)}</strong>
                    <span className={event.triggered ? "badge danger" : "badge"}>{event.triggered ? "ausgelöst" : "ok"}</span>
                    <span>Beobachtet: {event.observedValue} · Schwellwert: {labelForComparator(event.comparator)} {event.threshold}</span>
                    <span className="muted">{event.evaluatedAt}</span>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Noch keine Alert-Events. Klicke „Alerts auswerten", um Regeln gegen aktuelle Kennzahlen zu prüfen.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function labelForReportType(type: ReportType): string {
  switch (type) {
    case "weekly_summary": return "Wochenzusammenfassung";
    case "opportunity_digest": return "Opportunity-Digest";
    case "authority_report": return "Authority-Report";
    default: return type;
  }
}

function labelForMetric(metric: AlertMetric): string {
  switch (metric) {
    case "visibility_score": return "Sichtbarkeits-Score";
    case "health_score": return "Health-Score";
    case "open_opportunities": return "Offene Opportunities";
    case "referring_domains": return "Referring Domains";
    default: return metric;
  }
}

function labelForComparator(comparator: AlertComparator): string {
  switch (comparator) {
    case "lt": return "<";
    case "lte": return "≤";
    case "gt": return ">";
    case "gte": return "≥";
    default: return comparator;
  }
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.generated)) return { kind: "success", message: "Report erfolgreich generiert." };
  if (singleParam(params?.delivered)) return { kind: "success", message: "Report erfolgreich versendet." };
  if (singleParam(params?.schedule)) return { kind: "success", message: "Zeitplan angelegt." };
  const due = singleParam(params?.due);
  if (due !== undefined) return { kind: "success", message: `Fällige Schedules ausgeführt — ${due} Report(s) generiert.` };
  if (singleParam(params?.alertrule)) return { kind: "success", message: "Alert-Regel angelegt." };
  if (singleParam(params?.evaluated)) return { kind: "success", message: "Alerts ausgewertet." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
