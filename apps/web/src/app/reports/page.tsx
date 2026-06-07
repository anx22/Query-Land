import "../../features/reports/reports.css";

import {
  ALERT_COMPARATORS,
  ALERT_METRICS,
  DELIVERY_CHANNELS,
  REPORT_CADENCES,
  REPORT_TYPES,
} from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { MetricCard } from "../../components/metric-card";
import { TermTooltip } from "../../components/term-tooltip";
import { GlossarLink } from "../../components/glossar-link";
import { WhyItMatters } from "../../components/why-it-matters";
import { AlertMetricChart } from "../../features/reports/alert-metric-chart";
import {
  buildAlertChartModel,
  countTriggered,
  eventSeverity,
  formatMetricValue,
  formatTimestamp,
  labelForCadence,
  labelForChannel,
  labelForComparator,
  labelForMetric,
  labelForReportType,
  metricsFromRules,
  scheduleStatus,
  scheduleStatusBadge,
  scheduleStatusLabel,
  severityBadge,
  severityLabel,
} from "../../features/reports/reports-logic";
import { loadReportsData } from "../../lib/reports-api";
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
  const data = await loadReportsData();
  const feedback = feedbackMessage(params);

  const triggeredCount = countTriggered(data.alertEvents);
  const projectId = data.selectedProject?.id ?? "";
  const disabled = !data.connected || !data.selectedProject;

  // Build a per-metric chart model from rules + events (metric vs. threshold).
  const alertMetrics = metricsFromRules(data.alertRules);
  const alertModels = alertMetrics.map((metric) => ({
    metric,
    rule: data.alertRules.find((r) => r.metric === metric) ?? null,
    model: buildAlertChartModel(metric, data.alertEvents),
  }));
  const recentEvents = data.alertEvents
    .slice()
    .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime())
    .slice(0, 12);

  return (
    <AppShell activePath="/reports">
      {/* Hero — metaphor lives only in the framing copy (Serious-Zone elsewhere). */}
      <section className="card hero-card">
        <p className="kicker">Reporting &amp; Alarme</p>
        <h1>
          <TermTooltip term="report">Reports</TermTooltip> &amp; <TermTooltip term="alert">Alarme</TermTooltip>
        </h1>
        <p>
          Halten Sie den Stand Ihrer Sichtbarkeit fest: generierte Snapshots aus Health, Opportunities, Sichtbarkeit und Authority, geplante Lieferungen und Schwellwert-Alarme auf projektweite Kennzahlen.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
        {data.connected && !data.selectedProject ? (
          <p className="notice">Kein Projekt ausgewählt. Legen Sie zuerst ein Projekt an, um Reports zu erzeugen.</p>
        ) : null}
        <div className="action-row">
          <form action={generateReportAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <label>
              Report-Typ
              <select name="type" defaultValue="weekly_summary">
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{labelForReportType(t)}</option>
                ))}
              </select>
            </label>
            <button className="button" type="submit" disabled={disabled}>Report generieren</button>
          </form>
          <form action={runDueAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <button className="button secondary" type="submit" disabled={disabled}>Fällige Schedules ausführen</button>
          </form>
        </div>
      </section>

      {/* Metric grid */}
      <section className="metric-grid">
        <MetricCard
          label="Reports"
          value={String(data.reports.length)}
          info={<>Feste Snapshots aus Health, Chancen, Sichtbarkeit und Authority. Siehe <GlossarLink term="Report / Alert">Report</GlossarLink>.</>}
          note="generierte Snapshots"
        />
        <MetricCard
          label="Schedules"
          value={String(data.schedules.length)}
          info="Automatische Lieferungen in fester Kadenz (z. B. wöchentlich) an einen Kanal."
          note="geplante Lieferungen"
        />
        <MetricCard
          label="Alert-Regeln"
          value={String(data.alertRules.length)}
          info={<>Schwellwerte auf Kennzahlen, die einen <GlossarLink term="Report / Alert">Alarm</GlossarLink> auslösen, wenn sie über-/unterschritten werden.</>}
          note="definierte Schwellwerte"
        />
        <MetricCard
          label="Ausgelöste Alarme"
          value={String(triggeredCount)}
          info="Events, bei denen eine Kennzahl die definierte Schwelle verletzt hat."
          note={`von ${data.alertEvents.length} ausgewerteten Events`}
        />
      </section>

      {/* Reports inventory */}
      <section className="card">
        <p className="kicker">Reports-Bestand</p>
        <h2>Generierte Reports</h2>
        <WhyItMatters>Ein fester Snapshot je Lieferung macht Fortschritt belegbar — auch rückwirkend.</WhyItMatters>
        {data.reports.length > 0 ? (
          <div className="reports-table-scroll">
            <table className="reports-table">
              <thead>
                <tr>
                  <th scope="col">Titel</th>
                  <th scope="col">Typ</th>
                  <th scope="col">Generiert</th>
                  <th scope="col">Sektionen</th>
                  <th scope="col">Export</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.title}</td>
                    <td><span className="badge">{labelForReportType(report.type)}</span></td>
                    <td className="reports-row__meta">{formatTimestamp(report.generatedAt)}</td>
                    <td className="reports-row__meta">{report.sections.length}</td>
                    <td>
                      <div className="reports-actions">
                        {(["csv", "html", "pdf"] as const).map((format) => (
                          <a
                            key={format}
                            className="button secondary compact"
                            href={`/api/export/reports/${report.id}/export?format=${format}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {format.toUpperCase()}
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="reports-empty">
            <span className="reports-empty__glyph" aria-hidden="true">🗺️</span>
            <strong className="reports-empty__title">Noch kein Report vorhanden</strong>
            <span>Erzeugen Sie oben den ersten Snapshot, um den Stand Ihrer Sichtbarkeit festzuhalten.</span>
          </div>
        )}

        {/* Latest report detail + delivery */}
        {data.latestReport ? (
          <div>
            <h3>Letzter Report: {data.latestReport.title}</h3>
            {data.latestReport.sections.map((section) => (
              <div key={section.title}>
                <p className="kicker">{section.title}</p>
                {section.rows.length > 0 ? (
                  <table className="reports-table">
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
            <p className="kicker">Report versenden</p>
            <form action={deliverReportAction} className="inline-form">
              <input type="hidden" name="reportId" value={data.latestReport.id} />
              <label>
                Kanal
                <select name="channel" defaultValue="email">
                  {DELIVERY_CHANNELS.map((c) => (
                    <option key={c} value={c}>{labelForChannel(c)}</option>
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
        ) : null}
      </section>

      <section className="content-grid">
        {/* Schedules */}
        <div className="card">
          <p className="kicker">Schedules</p>
          <h2>Geplante Lieferungen</h2>
          <WhyItMatters>Automatische Lieferungen halten Stakeholder ohne manuelles Nachfassen auf dem Laufenden.</WhyItMatters>

          {data.schedules.length > 0 ? (
            <div className="table-list">
              {data.schedules.map((schedule) => {
                const status = scheduleStatus(schedule);
                const badge = scheduleStatusBadge(status);
                return (
                  <article key={schedule.id} className="reports-row">
                    <strong className="reports-row__title">{labelForReportType(schedule.type)}</strong>
                    <span className="badge">{labelForCadence(schedule.cadence)}</span>
                    <span className="badge">{labelForChannel(schedule.channel)}</span>
                    {schedule.target ? <span className="reports-row__meta">{schedule.target}</span> : null}
                    <span className="reports-row__spacer" />
                    <span className={badge ? `badge ${badge}` : "badge"}>{scheduleStatusLabel(status)}</span>
                    <span className="reports-row__meta">Letzter Lauf: {formatTimestamp(schedule.lastRunAt)}</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="reports-empty">
              <strong className="reports-empty__title">Noch keine Schedules angelegt</strong>
              <span>Legen Sie unten eine Kadenz fest, damit Reports automatisch erzeugt werden.</span>
            </div>
          )}

          <h3>Schedule anlegen</h3>
          <form action={createScheduleAction}>
            <input type="hidden" name="projectId" value={projectId} />
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
                  <option key={c} value={c}>{labelForCadence(c)}</option>
                ))}
              </select>
            </label>
            <label>
              Lieferkanal (optional)
              <select name="channel">
                <option value="">— keiner —</option>
                {DELIVERY_CHANNELS.map((c) => (
                  <option key={c} value={c}>{labelForChannel(c)}</option>
                ))}
              </select>
            </label>
            <label>
              Ziel (optional)
              <input type="text" name="target" placeholder="z. B. team@example.com" />
            </label>
            <button className="button" type="submit" disabled={disabled}>Schedule anlegen</button>
          </form>
        </div>

        {/* Alerts */}
        <div className="card">
          <p className="kicker">Alarme</p>
          <h2>
            <TermTooltip term="alert">Alarm</TermTooltip>-Regeln &amp; Events
          </h2>
          <WhyItMatters>Schwellwert-Alarme melden Einbrüche, bevor sie unbemerkt Traffic kosten.</WhyItMatters>

          {/* Metric vs. threshold — gauge / mini-trend where data allows */}
          {alertModels.length > 0 ? (
            <div className="reports-alert-grid">
              {alertModels.map(({ metric, rule, model }) => (
                <div key={metric} className="reports-alert-card">
                  <div className="reports-alert-card__head">
                    <span className="reports-alert-card__metric">{labelForMetric(metric)}</span>
                    {rule ? (
                      <span className={model.triggered ? "badge danger" : "badge"}>
                        {labelForComparator(rule.comparator)} {rule.threshold}
                      </span>
                    ) : null}
                    <ConfidenceBadge level="A" showLabel={false} />
                  </div>

                  {model.kind !== "none" ? (
                    <AlertMetricChart model={model} />
                  ) : (
                    <p className="muted">
                      {model.observedValue !== null
                        ? `Zuletzt beobachtet: ${formatMetricValue(model.observedValue)}`
                        : "Noch nicht ausgewertet — Schwelle definiert, aber keine Messung."}
                    </p>
                  )}

                  <div className="reports-alert-card__numbers">
                    {model.observedValue !== null ? (
                      <span>Beobachtet: <strong>{formatMetricValue(model.observedValue)}</strong></span>
                    ) : null}
                    {model.threshold !== null && model.comparator !== null ? (
                      <span>Schwelle: <strong>{labelForComparator(model.comparator)} {formatMetricValue(model.threshold)}</strong></span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="reports-empty">
              <strong className="reports-empty__title">Noch keine Alarm-Regeln</strong>
              <span>Definieren Sie unten einen Schwellwert auf eine Kennzahl, um Einbrüche automatisch zu erkennen.</span>
            </div>
          )}

          <h3>Regel erstellen</h3>
          <form action={createAlertRuleAction}>
            <input type="hidden" name="projectId" value={projectId} />
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
            <button className="button" type="submit" disabled={disabled}>Regel anlegen</button>
          </form>

          <form action={evaluateAlertsAction} className="action-row">
            <input type="hidden" name="projectId" value={projectId} />
            <button className="button secondary" type="submit" disabled={disabled}>Alarme auswerten</button>
          </form>

          {/* Recent alert events — factual list with severity */}
          <h3>Letzte Alarm-Events</h3>
          {recentEvents.length > 0 ? (
            <div className="table-list">
              {recentEvents.map((event) => {
                const severity = eventSeverity(event);
                return (
                  <article key={event.id} className="reports-row">
                    <strong className="reports-row__title">{labelForMetric(event.metric)}</strong>
                    <span className={`badge ${severityBadge(severity)}`}>{severityLabel(severity)}</span>
                    <span className="reports-row__meta">
                      Beobachtet {formatMetricValue(event.observedValue)} · Schwelle {labelForComparator(event.comparator)} {formatMetricValue(event.threshold)}
                    </span>
                    <span className="reports-row__spacer" />
                    <span className="reports-row__meta">{formatTimestamp(event.evaluatedAt)}</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">Noch keine Events. Klicken Sie „Alarme auswerten", um Regeln gegen aktuelle Kennzahlen zu prüfen.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.generated)) return { kind: "success", message: "Report erfolgreich generiert." };
  if (singleParam(params?.delivered)) return { kind: "success", message: "Report erfolgreich versendet." };
  if (singleParam(params?.schedule)) return { kind: "success", message: "Schedule angelegt." };
  const due = singleParam(params?.due);
  if (due !== undefined) return { kind: "success", message: `Fällige Schedules ausgeführt — ${due} Report(s) generiert.` };
  if (singleParam(params?.alertrule)) return { kind: "success", message: "Alarm-Regel angelegt." };
  if (singleParam(params?.evaluated)) return { kind: "success", message: "Alarme ausgewertet." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
