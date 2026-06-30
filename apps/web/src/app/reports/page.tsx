import "../../features/reports/reports.css";

import {
  ALERT_COMPARATORS,
  ALERT_METRICS,
  DELIVERY_CHANNELS,
  REPORT_CADENCES,
  REPORT_TYPES,
} from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { MetricCard } from "../../components/metric-card";
import { TermTooltip } from "../../components/term-tooltip";
import { GlossarLink } from "../../components/glossar-link";
import { Icon } from "../../components/icon";
import { PREREQUISITE_META } from "../../lib/readiness";
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
        <p className="kicker">Berichte &amp; Warnungen</p>
        <h1>
          <TermTooltip term="report">Reports</TermTooltip> &amp; <TermTooltip term="alert">Alarme</TermTooltip>
        </h1>
        <p>
          Berichte als Momentaufnahme Ihrer wichtigsten Kennzahlen (Health, Sichtbarkeit, Chancen,
          Backlinks) — sofort als CSV, HTML oder PDF exportierbar, mit Warnungen, sobald ein Wert
          eine festgelegte Schwelle über- oder unterschreitet.
        </p>
        <div className="badge-row">
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <OfflineNotice /> : null}
        {data.connected && !data.selectedProject ? (
          <p className="notice">Kein Projekt ausgewählt. Legen Sie zuerst ein Projekt an, um Reports zu erzeugen.</p>
        ) : null}
        <div className="action-row">
          <form action={generateReportAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <label>
              Berichtstyp
              <select name="type" defaultValue="weekly_summary">
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{labelForReportType(t)}</option>
                ))}
              </select>
            </label>
            <button className="button" type="submit" disabled={disabled}>Bericht erstellen</button>
          </form>
          <form action={runDueAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <button className="button secondary" type="submit" disabled={disabled}>Fällige Lieferungen ausführen</button>
          </form>
          {disabled ? (
            <span className="locked-action__reason">
              <Icon name="lock" />
              {!data.connected ? "API nicht erreichbar." : PREREQUISITE_META.project.reason}
            </span>
          ) : null}
        </div>
      </section>

      {/* Metric grid */}
      <section className="metric-grid">
        <MetricCard
          label="Berichte"
          value={String(data.reports.length)}
          info={<>Feste Momentaufnahmen aus Health, Chancen, Sichtbarkeit und Backlinks. Siehe <GlossarLink term="Report / Alert">Report</GlossarLink>.</>}
          note="erstellte Berichte"
        />
        <MetricCard
          label="Lieferungen"
          value={String(data.schedules.length)}
          info="Automatische Lieferungen in festem Rhythmus (z. B. wöchentlich) an einen Empfänger."
          note="automatisch geplant"
        />
        <MetricCard
          label="Warn-Regeln"
          value={String(data.alertRules.length)}
          info={<>Schwellen auf Kennzahlen, die eine <GlossarLink term="Report / Alert">Warnung</GlossarLink> auslösen, wenn sie über- oder unterschritten werden.</>}
          note="festgelegte Schwellen"
        />
        <MetricCard
          label="Ausgelöste Warnungen"
          value={String(triggeredCount)}
          info="Fälle, in denen eine Kennzahl die festgelegte Schwelle verletzt hat."
          note={`von ${data.alertEvents.length} geprüften Messungen`}
        />
      </section>

      {/* Reports inventory */}
      <section className="card">
        <p className="kicker">Vorhandene Berichte</p>
        <h2>Generierte Reports</h2>
        <WhyItMatters>Eine feste Momentaufnahme je Lieferung macht Fortschritt belegbar — auch rückwirkend.</WhyItMatters>
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
            <span>Erstellen Sie oben den ersten Bericht, um den Stand Ihrer Sichtbarkeit festzuhalten.</span>
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
              <div className="locked-action">
                <button className="button" type="submit" disabled={!data.connected}>Versenden</button>
                {!data.connected ? (
                  <span className="locked-action__reason">
                    <Icon name="lock" />
                    API nicht erreichbar.
                  </span>
                ) : null}
              </div>
            </form>
            <p className="form-hint muted">
              Webhook wird sofort zugestellt. E-Mail braucht einen konfigurierten Versand
              (<code>RESEND_API_KEY</code>) — sonst wird die Lieferung ehrlich als „übersprungen“ vermerkt.
            </p>
          </div>
        ) : null}
      </section>

      <section className="content-grid">
        {/* Schedules */}
        <div className="card">
          <p className="kicker">Automatische Lieferung</p>
          <h2>Geplante Lieferungen</h2>
          <WhyItMatters>Automatische Lieferungen halten alle Beteiligten ohne manuelles Nachfassen auf dem Laufenden.</WhyItMatters>
          <p className="notice">
            Fällige Zeitpläne werden täglich automatisch erzeugt und zugestellt: <strong>Webhook</strong>{" "}
            sofort, <strong>E-Mail</strong> sobald ein Versand konfiguriert ist (<code>RESEND_API_KEY</code>).
            Ohne Konfiguration bleibt die E-Mail-Zustellung ehrlich „übersprungen“ — Berichte stehen
            jederzeit als Export (CSV/HTML/PDF) bereit.
          </p>

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
              <strong className="reports-empty__title">Noch keine Lieferungen geplant</strong>
              <span>Legen Sie unten einen Rhythmus fest, damit Berichte automatisch erstellt werden.</span>
            </div>
          )}

          <h3>Lieferung planen</h3>
          <form action={createScheduleAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <label>
              Berichtstyp
              <select name="type" defaultValue="weekly_summary">
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{labelForReportType(t)}</option>
                ))}
              </select>
            </label>
            <label>
              Rhythmus
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
            <button className="button" type="submit" disabled={disabled}>Lieferung planen</button>
          </form>
        </div>

        {/* Alerts */}
        <div className="card">
          <p className="kicker">Warnungen</p>
          <h2>
            <TermTooltip term="alert">Warn</TermTooltip>-Regeln &amp; Auslösungen
          </h2>
          <WhyItMatters>Schwellen-Warnungen melden Einbrüche, bevor sie unbemerkt Traffic kosten.</WhyItMatters>

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
              <strong className="reports-empty__title">Noch keine Warn-Regeln</strong>
              <span>Definieren Sie unten eine Schwelle auf eine Kennzahl, um Einbrüche automatisch zu erkennen.</span>
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
              Schwelle
              <input type="number" name="threshold" step="any" placeholder="z. B. 50" required />
            </label>
            <button className="button" type="submit" disabled={disabled}>Regel anlegen</button>
          </form>

          <form action={evaluateAlertsAction} className="action-row">
            <input type="hidden" name="projectId" value={projectId} />
            <button className="button secondary" type="submit" disabled={disabled}>Warnungen prüfen</button>
          </form>

          {/* Recent alert events — factual list with severity */}
          <h3>Letzte Auslösungen</h3>
          {recentEvents.length > 0 ? (
            <div className="table-list">
              {recentEvents.map((event) => {
                const severity = eventSeverity(event);
                return (
                  <article key={event.id} className="reports-row">
                    <strong className="reports-row__title">{labelForMetric(event.metric)}</strong>
                    <span className={`badge ${severityBadge(severity)}`}>{severityLabel(severity)}</span>
                    <span className="facts">
                      <span className="fact">
                        <span className="fact__label">Beobachtet</span>
                        <span className="fact__value">{formatMetricValue(event.observedValue)}</span>
                      </span>
                      <span className="fact">
                        <span className="fact__label">Schwelle</span>
                        <span className="fact__value">{labelForComparator(event.comparator)} {formatMetricValue(event.threshold)}</span>
                      </span>
                    </span>
                    <span className="reports-row__spacer" />
                    <span className="reports-row__meta">{formatTimestamp(event.evaluatedAt)}</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">Noch keine Auslösungen. Klicken Sie „Warnungen prüfen", um die Regeln gegen die aktuellen Kennzahlen zu prüfen.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.generated)) return { kind: "success", message: "Bericht erfolgreich erstellt." };
  if (singleParam(params?.delivered)) return { kind: "success", message: "Bericht erfolgreich versendet." };
  if (singleParam(params?.schedule)) return { kind: "success", message: "Lieferung geplant." };
  const due = singleParam(params?.due);
  if (due !== undefined) return { kind: "success", message: `Fällige Lieferungen ausgeführt — ${due} Bericht(e) erstellt.` };
  if (singleParam(params?.alertrule)) return { kind: "success", message: "Warn-Regel angelegt." };
  if (singleParam(params?.evaluated)) return { kind: "success", message: "Warnungen ausgewertet." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
