/**
 * Dashboard (Overview UX-1) — real SEO Overview screen.
 *
 * Composition per spec §5.4:
 *   1. TrendChart hero (Visibility over time) + ScoreGauge (Health Score)
 *   2. KPI row: Visibility-Index + Health Score with DeltaChip
 *   3. PositionDistribution histogram
 *   4. Top-Chancen mini-matrix (open opportunities, ≤ 5)
 *   5. Risks — open critical audit issues
 *   6. Recent crawl runs + reports
 *
 * All sections render graceful empty-states (no crash on empty DB).
 * Zero demo fixtures — real API data only via OverviewData.
 *
 * Serious-Zone (Teil 1 §1): no metaphor in charts/numbers/status/confidence.
 * Land-metaphor allowed only in empty-state copy.
 */

import type { OverviewData } from "../lib/overview-api";
import { OverviewHeader } from "./overview-header";
import { OfflineNotice } from "./offline-notice";
import { ModulesPending } from "./modules-pending";
import { ConfidenceBadge } from "./confidence-badge";
import { DeltaChip } from "./delta-chip";
import { WhyItMatters } from "./why-it-matters";
import { TermTooltip } from "./term-tooltip";
import { InfoTip } from "./info-tip";
import { GlossarLink } from "./glossar-link";

// Client chart islands — imported for use in this server component.
// Next.js will tree-shake them correctly; only the client bundle includes recharts.
import { TrendChart } from "./charts/trend-chart";
import { ScoreGauge } from "./charts/score-gauge";
import { PositionDistribution } from "./charts/position-distribution";
import type { Opportunity } from "@seo-tool/domain-model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function opportunityTypeLabel(type: Opportunity["type"]): string {
  switch (type) {
    case "technical_fix":       return "Technischer Fix";
    case "low_hanging_keyword": return "Keyword-Chance";
    case "cannibalization":     return "Kannibalisierung";
    case "money_page":          return "Money-Page";
    case "internal_link_gap":   return "Interne Verlinkung";
    case "aeo":                 return "AEO";
    default:                    return type;
  }
}

function opportunityTypeClass(type: Opportunity["type"]): string {
  switch (type) {
    case "technical_fix":       return "badge-cat-technical";
    case "low_hanging_keyword": return "badge-cat-keyword";
    case "cannibalization":     return "badge-cat-cannibal";
    case "money_page":          return "badge-cat-money";
    case "internal_link_gap":   return "badge-cat-link";
    case "aeo":                 return "badge-cat-aeo";
    default:                    return "";
  }
}

/** Map opportunity.confidence (0–1 float) to ConfidenceBadge level A–E. */
function confidenceToLevel(conf: number): "A" | "B" | "C" | "D" | "E" {
  if (conf >= 0.9) return "A";
  if (conf >= 0.7) return "B";
  if (conf >= 0.5) return "C";
  if (conf >= 0.3) return "D";
  return "E";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function crawlStatusLabel(status: string): string {
  if (status === "succeeded") return "Erfolgreich";
  if (status === "running") return "Läuft";
  if (status === "failed") return "Fehlgeschlagen";
  return status;
}

function crawlTriggerLabel(trigger: string): string {
  if (trigger === "manual") return "manuell";
  if (trigger === "scheduled") return "geplant";
  if (trigger === "deploy") return "Deployment";
  return trigger;
}

function crawlStatusClass(status: string): string {
  if (status === "succeeded") return "succeeded";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  return "queued";
}

// ---------------------------------------------------------------------------
// Overview component
// ---------------------------------------------------------------------------

export function Dashboard({ data }: { data: OverviewData }) {
  const {
    connected,
    project,
    site,
    visibilityTrend,
    latestVisibility,
    previousVisibility,
    latestHealthScore,
    previousHealthScore,
    positionBuckets,
    topOpportunities,
    criticalIssues,
    recentCrawlRuns,
    recentReports,
  } = data;

  // Project-first cockpit: the Overview is the cockpit OF the active project.
  // With no project there is nothing to show — guide straight to creation
  // instead of a wall of empty KPI charts. (The OnboardingChecklist above, in
  // AppShell, carries the full waterfall.)
  if (connected && !project) {
    return (
      <section className="card overview-cockpit-empty">
        <p className="kicker">Übersicht · Keine Website</p>
        <h1>Die Übersicht ist das Cockpit Ihrer Website</h1>
        <p className="muted">
          Legen Sie zuerst eine Website an — danach füllt sich diese Übersicht mit Sichtbarkeit,
          Health Score und Chancen.
        </p>
        <a className="button" href="/projects">
          Website hinzufügen
        </a>
      </section>
    );
  }

  // Delta calculations (plain numbers; null = no previous data)
  const visibilityDelta =
    latestVisibility !== null && previousVisibility !== null
      ? latestVisibility.score - previousVisibility.score
      : null;

  const healthDelta =
    latestHealthScore !== null && previousHealthScore !== null
      ? latestHealthScore.score - previousHealthScore.score
      : null;

  // Two-mode cockpit: until the first analysis has produced something real, the KPI bento,
  // charts, gauges and activity panels render as a wall of empty "—" boxes that reads as
  // broken. Show a single calm "first analysis" panel instead and reveal the machinery only
  // once there is data to show.
  const hasData =
    latestVisibility !== null ||
    latestHealthScore !== null ||
    positionBuckets.total > 0 ||
    topOpportunities.length > 0 ||
    criticalIssues.length > 0 ||
    recentCrawlRuns.length > 0 ||
    recentReports.length > 0;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* O-1 Editorial page header — serif claim + Ridges contour band       */}
      {/* ------------------------------------------------------------------ */}
      <OverviewHeader projectName={project?.name ?? null} />

      {/* ------------------------------------------------------------------ */}
      {/* Offline / API-not-reachable notice                                  */}
      {/* ------------------------------------------------------------------ */}
      {!connected && <OfflineNotice />}

      {/* First-run: no analysis yet → one calm panel instead of empty machinery. */}
      {connected && project && !hasData && (
        <ModulesPending
          icon="dashboard"
          title="Bereit für Ihre erste Analyse"
          text="Ihre Kennzahlen, der Sichtbarkeits-Verlauf und priorisierte Chancen erscheinen hier, sobald Sie die erste Analyse gestartet haben."
          ctaHref="/technical-audit#crawl-start"
          ctaLabel="Analyse starten →"
          ctaVariant="secondary"
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* O-2 KPI Bento — measured headline numbers (mono), real data only    */}
      {/* ------------------------------------------------------------------ */}
      {connected && project && hasData && (
        <section className="kpi-bento" aria-label="Kennzahlen im Überblick">
          <article className="kpi-card">
            <p className="kpi-card__label">
              <TermTooltip term="Visibility-Index">Visibility-Index</TermTooltip>
              <InfoTip label="Visibility-Index erklären">
                Positionsgewichtete Sichtbarkeit (0–100) auf dem eigenen Keyword-Set. Mehr im{" "}
                <GlossarLink term="Visibility-Index">Glossar</GlossarLink>.
              </InfoTip>
            </p>
            <span className="metric-value kpi-card__value">
              {latestVisibility !== null ? latestVisibility.score.toLocaleString("de-DE") : "—"}
            </span>
            <div className="kpi-card__foot">
              {visibilityDelta !== null && <DeltaChip value={visibilityDelta} />}
              {latestVisibility !== null && <ConfidenceBadge level="C" />}
            </div>
          </article>

          <article className="kpi-card">
            <p className="kpi-card__label">
              <TermTooltip term="Health Score">Health Score</TermTooltip>
            </p>
            <span className="metric-value kpi-card__value">
              {latestHealthScore !== null ? latestHealthScore.score.toLocaleString("de-DE") : "—"}
            </span>
            <div className="kpi-card__foot">
              {healthDelta !== null && <DeltaChip value={healthDelta} />}
              {latestHealthScore !== null && <ConfidenceBadge level="A" />}
            </div>
          </article>

          <article className="kpi-card">
            <p className="kpi-card__label">
              <TermTooltip term="Keyword / Intent">Keywords getrackt</TermTooltip>
            </p>
            <span className="metric-value kpi-card__value">
              {positionBuckets.total > 0 ? positionBuckets.total.toLocaleString("de-DE") : "—"}
            </span>
            <div className="kpi-card__foot">
              {/* Same SERP-sample source as Visibility/Striking → grade C, not B (consistency + honesty). */}
              {positionBuckets.total > 0 && <ConfidenceBadge level="C" />}
            </div>
          </article>

          <article className="kpi-card">
            <p className="kpi-card__label">
              <TermTooltip term="Striking Distance">Striking Distance</TermTooltip>
              <InfoTip label="Striking Distance erklären">
                Keywords auf Position 11–20 — die günstigsten Hebel für schnelle Sichtbarkeitsgewinne.
              </InfoTip>
            </p>
            <span className="metric-value kpi-card__value">
              {positionBuckets.total > 0 ? positionBuckets.strikingDist.toLocaleString("de-DE") : "—"}
            </span>
            <div className="kpi-card__foot">
              {positionBuckets.total > 0 && <ConfidenceBadge level="C" />}
            </div>
          </article>
        </section>
      )}

      {/* Data mode — the full cockpit renders only once there is something real to show. */}
      {hasData && (
      <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero: Visibility TrendChart + Health ScoreGauge                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="overview-hero" aria-labelledby="overview-hero-heading">
        <div className="card overview-hero__trend">
          <div className="overview-section-header">
            <div>
              <h2 id="overview-hero-heading">
                <TermTooltip term="Visibility-Index">Visibility</TermTooltip>
                {"-Verlauf"}
              </h2>
              <WhyItMatters>
                Zeigt, wie sich Ihre positionsgewichtete Sichtbarkeit über die Zeit entwickelt — Grundlage jeder Priorisierungsentscheidung.
              </WhyItMatters>
            </div>
          </div>

          {/* Chart island — server data passed as plain serialisable props */}
          <TrendChart
            data={visibilityTrend}
            title="Visibility-Verlauf"
            valueLabel="Visibility-Index"
          />

          {/* Site context */}
          {site && (
            <p className="overview-site-context">
              Website: <strong>{site.baseUrl}</strong>
            </p>
          )}
        </div>

        {/* HealthScore gauge — side column */}
        <div className="card overview-hero__gauge">
          <p className="kicker">
            <TermTooltip term="Health Score">Health Score</TermTooltip>
            <InfoTip label="Health Score erklären">
              Gewichteter technischer Gesundheitswert (0–100) aus offenen Issues nach Schweregrad. Siehe{" "}
              <GlossarLink term="Health Score">Glossar</GlossarLink>.
            </InfoTip>
          </p>
          <WhyItMatters>
            Aggregierter technischer Gesundheitswert — kritische Issues drücken den Score.
          </WhyItMatters>
          <div className="overview-chart">
            <ScoreGauge
              value={latestHealthScore?.score ?? null}
              max={100}
              label="Health Score"
              size={160}
            />
          </div>
          {healthDelta !== null && (
            <div className="overview-center">
              <DeltaChip value={healthDelta} />
              <span className="overview-delta-note">seit letzter Berechnung</span>
            </div>
          )}
          {latestHealthScore !== null && (
            <div className="overview-center">
              <ConfidenceBadge level="A" />
            </div>
          )}
          {latestHealthScore === null && (
            <p className="overview-empty-hint">
              Noch kein Health Score berechnet. Starten Sie eine Analyse im Technical Audit.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Position Distribution                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="content-grid" aria-labelledby="overview-distribution-heading">
        <div className="card">
          <h2 id="overview-distribution-heading">
            <TermTooltip term="Ranking / Position">Positions</TermTooltip>
            -Verteilung
          </h2>
          <WhyItMatters text="Striking-Distance-Keywords (Position 11–20) sind die günstigsten Hebel für schnelle Sichtbarkeitsgewinne." />
          <div className="overview-chart">
            <PositionDistribution
              buckets={positionBuckets}
              title="Positions-Verteilung der Keywords"
            />
          </div>
          {positionBuckets.total > 0 && (
            <p className="overview-site-context">
              {positionBuckets.total} Keywords insgesamt
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Top Opportunities mini-matrix                                     */}
        {/* ---------------------------------------------------------------- */}
        <div className="card">
          <h2>Top-Chancen</h2>
          <WhyItMatters text="Offene Optimierungschancen, priorisiert nach Impact × Konfidenz." />
          {topOpportunities.length === 0 ? (
            <div className="overview-empty-state">
              <p className="overview-empty-state__text">
                Noch keine Chancen — starten Sie zuerst eine Analyse Ihrer Website. Daraus entstehen
                anschließend priorisierte Optimierungschancen.
              </p>
              <a className="button overview-cta" href="/technical-audit#crawl-start">
                Analyse starten →
              </a>
            </div>
          ) : (
            <div className="overview-opportunity-list">
              {topOpportunities.map((opp) => (
                <article key={opp.id} className="overview-opportunity-item">
                  <div className="overview-opportunity-item__header">
                    <span className={`badge overview-opportunity-item__type ${opportunityTypeClass(opp.type)}`}>
                      {opportunityTypeLabel(opp.type)}
                    </span>
                    <ConfidenceBadge level={confidenceToLevel(opp.confidence)} showLabel={false} />
                  </div>
                  <p className="overview-opportunity-item__action">{opp.recommendedAction}</p>
                  <div className="overview-opportunity-item__meta">
                    <span>Impact {opp.expectedImpact}/5</span>
                    <span>Aufwand {opp.effort}/5</span>
                    <span>Priorität {opp.priority}</span>
                  </div>
                </article>
              ))}
              <a href="/content-opportunities" className="overview-link-more">
                Alle Chancen ansehen →
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Risks + Crawl/Reports                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="content-grid" aria-labelledby="overview-risks-heading">
        {/* Risks: open critical issues */}
        <div className="card">
          <h2 id="overview-risks-heading">Offene Risiken</h2>
          <WhyItMatters text="Kritische technische Issues blockieren Crawler und kosten organischen Traffic." />
          {criticalIssues.length === 0 ? (
            <div className="overview-empty-state">
              <p className="overview-empty-state__text">
                Keine offenen kritischen Issues.
                {!site && " Starten Sie eine Analyse, um technische Probleme zu erkennen."}
              </p>
            </div>
          ) : (
            <div className="table-list overview-issue-list">
              {criticalIssues.slice(0, 8).map((issue) => (
                <article key={issue.id}>
                  <strong className="overview-issue-rule">
                    <span className="badge danger">{issue.severity}</span>{" "}
                    {issue.rule.replace(/_/g, " ")}
                  </strong>
                  <span>{issue.message}</span>
                  <span className="overview-issue-url">{issue.url}</span>
                </article>
              ))}
              {criticalIssues.length > 8 && (
                <a href="/technical-audit" className="overview-link-more">
                  + {criticalIssues.length - 8} weitere → Technical Audit
                </a>
              )}
            </div>
          )}
        </div>

        {/* Crawl runs + Reports */}
        <div className="card">
          <h2>Letzte Aktivitäten</h2>
          <WhyItMatters text="Aktuelle Analyse-Ergebnisse und Reports geben Auskunft über den Stand der Daten." />

          {/* Crawl runs */}
          <p className="kicker overview-subhead">Analysen</p>
          {recentCrawlRuns.length === 0 ? (
            <p className="overview-empty-hint">
              Noch keine Analyse gestartet.{" "}
              <a href="/technical-audit">Jetzt starten →</a>
            </p>
          ) : (
            <ul className="status-list">
              {recentCrawlRuns.map((run) => (
                <li key={run.id}>
                  <span>
                    {crawlTriggerLabel(run.trigger)} · {formatDate(run.startedAt)}
                    {run.summary.discoveredUrls > 0 && (
                      <> · {run.summary.discoveredUrls} {run.summary.discoveredUrls === 1 ? "URL" : "URLs"}</>
                    )}
                  </span>
                  <span className={`status ${crawlStatusClass(run.status)}`}>
                    {crawlStatusLabel(run.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Reports */}
          <p className="kicker overview-subhead">Reports</p>
          {recentReports.length === 0 ? (
            <p className="overview-empty-hint">
              Noch keine Reports generiert.{" "}
              <a href="/reports">Jetzt generieren →</a>
            </p>
          ) : (
            <ul className="status-list">
              {recentReports.map((report) => (
                <li key={report.id}>
                  <span>{report.title} · {formatDate(report.generatedAt)}</span>
                  <span className="status succeeded">Generiert</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      </>
      )}
    </>
  );
}
