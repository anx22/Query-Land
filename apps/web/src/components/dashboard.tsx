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
        <p className="kicker">Übersicht · Kein Projekt</p>
        <h1>Die Übersicht ist das Cockpit Ihres Projekts</h1>
        <p className="muted">
          Ein Projekt ist die Klammer über allen Analysen. Legen Sie zuerst ein Projekt an —
          danach füllt sich diese Übersicht mit Sichtbarkeit, Health Score und Chancen.
        </p>
        <a className="button" href="/projects">
          Projekt anlegen
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

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* O-1 Editorial page header — serif claim + Ridges contour band       */}
      {/* ------------------------------------------------------------------ */}
      <OverviewHeader projectName={project?.name ?? null} />

      {/* ------------------------------------------------------------------ */}
      {/* Offline / API-not-reachable notice                                  */}
      {/* ------------------------------------------------------------------ */}
      {!connected && (
        <div className="notice danger" role="alert">
          API nicht erreichbar. Die Übersicht zeigt leere Zustände — bitte Backend prüfen.
        </div>
      )}

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
            {/* KPI chips inline with hero header */}
            <div className="overview-kpi-row">
              {latestVisibility !== null ? (
                <div className="overview-kpi-chip">
                  <span className="overview-kpi-chip__label">
                    <TermTooltip term="Visibility-Index">Visibility-Index</TermTooltip>
                    <InfoTip label="Visibility-Index erklären">
                      Positionsgewichtete Sichtbarkeit (0–100) auf dem eigenen Keyword-Set. Mehr im{" "}
                      <GlossarLink term="Visibility-Index">Glossar</GlossarLink>.
                    </InfoTip>
                  </span>
                  <span className="metric-value overview-kpi-chip__value">
                    {latestVisibility.score.toLocaleString("de-DE")}
                  </span>
                  {visibilityDelta !== null && (
                    <DeltaChip value={visibilityDelta} />
                  )}
                  <ConfidenceBadge level="C" />
                </div>
              ) : (
                <div className="overview-kpi-chip overview-kpi-chip--empty">
                  <span className="overview-kpi-chip__label">Visibility-Index</span>
                  <span className="metric-value overview-kpi-chip__value">—</span>
                </div>
              )}
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
              Site: <strong>{site.baseUrl}</strong>
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
          <div style={{ marginTop: "1rem" }}>
            <ScoreGauge
              value={latestHealthScore?.score ?? null}
              max={100}
              label="Health Score"
              size={160}
            />
          </div>
          {healthDelta !== null && (
            <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
              <DeltaChip value={healthDelta} />
              <span style={{ marginLeft: "0.4rem", color: "var(--muted)", fontSize: "0.8rem" }}>
                ggü. letzter Berechnung
              </span>
            </div>
          )}
          {latestHealthScore !== null && (
            <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
              <ConfidenceBadge level="A" />
            </div>
          )}
          {latestHealthScore === null && (
            <p className="overview-empty-hint">
              Noch kein Health Score berechnet. Starten Sie einen Crawl im Technical Audit.
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
          <div style={{ marginTop: "1rem" }}>
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
                Noch kein Terrain kartiert — starten Sie die Opportunity-Generierung im Technical Audit oder im Content-Chancen-Board.
              </p>
              <a className="button secondary" style={{ marginTop: "1rem", display: "inline-block" }} href="/content-opportunities">
                Chancen ansehen
              </a>
            </div>
          ) : (
            <div className="overview-opportunity-list" style={{ marginTop: "1rem" }}>
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
                {!site && " Starten Sie einen Crawl, um technische Probleme zu erkennen."}
              </p>
            </div>
          ) : (
            <div className="table-list" style={{ marginTop: "0.75rem" }}>
              {criticalIssues.slice(0, 8).map((issue) => (
                <article key={issue.id}>
                  <strong className="overview-issue-rule">
                    <span className="badge danger">{issue.severity}</span>{" "}
                    {issue.rule.replace(/_/g, " ")}
                  </strong>
                  <span>{issue.message}</span>
                  <span style={{ fontSize: "0.78rem" }}>{issue.url}</span>
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
          <WhyItMatters text="Aktuelle Crawl-Ergebnisse und Reports geben Auskunft über den Stand der Daten." />

          {/* Crawl runs */}
          <p className="kicker" style={{ marginTop: "1rem" }}>Crawl-Runs</p>
          {recentCrawlRuns.length === 0 ? (
            <p className="overview-empty-hint">
              Noch kein Crawl gestartet.{" "}
              <a href="/technical-audit">Jetzt starten →</a>
            </p>
          ) : (
            <ul className="status-list">
              {recentCrawlRuns.map((run) => (
                <li key={run.id}>
                  <span>
                    {run.trigger} · {formatDate(run.startedAt)}
                    {run.summary.discoveredUrls > 0 && (
                      <> · {run.summary.discoveredUrls} URLs</>
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
          <p className="kicker" style={{ marginTop: "1.25rem" }}>Reports</p>
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
  );
}
