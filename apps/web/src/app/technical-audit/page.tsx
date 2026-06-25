import "../../features/technical-audit/audit.css";

import { AppShell } from "../../components/app-shell";
import { ScoreGauge } from "../../components/charts/score-gauge";
import { IndexabilityFunnel } from "../../components/charts/indexability-funnel";
import { SectionTreemap } from "../../components/charts/section-treemap";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { DeltaChip } from "../../components/delta-chip";
import { TermTooltip } from "../../components/term-tooltip";
import { WhyItMatters } from "../../components/why-it-matters";
import { InfoTip } from "../../components/info-tip";
import { HelpPanel } from "../../components/help-panel";
import { GlossarLink } from "../../components/glossar-link";
import { IssueGroups } from "../../features/technical-audit/issue-groups";
import { IssueFilterBar } from "../../features/technical-audit/issue-filter-bar";
import { isDefaultIssueFilter, loadTechnicalAuditOverview } from "../../lib/audit-api";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const RUN_STATUS_LABEL: Record<string, string> = {
  running: "läuft",
  succeeded: "erfolgreich",
  failed: "fehlgeschlagen",
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const data = await loadTechnicalAuditOverview({
    issueStatus: firstParam(params.status),
    issueSeverity: firstParam(params.severity),
  });

  const healthValue = data.latestHealthScore?.score ?? null;
  const healthDelta =
    data.latestHealthScore && data.previousHealthScore
      ? data.latestHealthScore.score - data.previousHealthScore.score
      : null;

  return (
    <AppShell activePath="/technical-audit">
      <section className="card hero-card">
        <p className="kicker">Technical Audit</p>
        <h1>
          <TermTooltip term="crawl">Crawl</TermTooltip>-Überblick: Indexierbarkeit, Health &amp; Issues
        </h1>
        <p>
          Wo verlieren wir URLs auf dem Weg in den Index, wie gesund sind unsere Website-Bereiche und
          welche Probleme kosten am meisten? Dieser Überblick priorisiert technische SEO-Arbeit nach
          Wirkung.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.project?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.site?.baseUrl ?? "keine Site"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>
            {data.connected ? "API verbunden" : "API offline"}
          </span>
        </div>
        {!data.connected ? (
          <p className="notice danger">
            {data.errorMessage ?? "Audit-Daten konnten nicht geladen werden."} · Erwartete API:{" "}
            {data.apiBaseUrl}
          </p>
        ) : null}
      </section>

      {/* Help zone — layout-separated from the productive panels below */}
      <HelpPanel title="So liest du das Technical Audit">
        <p>
          Der <GlossarLink term="indexierbarkeit">Indexierbarkeits</GlossarLink>-Funnel zeigt,
          wo URLs auf dem Weg in den Google-Index verloren gehen. Der{" "}
          <GlossarLink term="health score">Health Score</GlossarLink> bündelt alle offenen
          Issues zu einer Zahl. Die Treemap verrät, welche Website-Bereiche die meisten
          Probleme tragen — dort lohnt sich die Arbeit zuerst.
        </p>
      </HelpPanel>

      {/* Health gauge + indexability funnel */}
      <section className="audit-overview-grid">
        <div className="card">
          <p className="kicker">
            <TermTooltip term="indexierbarkeit">Indexierbarkeit</TermTooltip>-Funnel
            <InfoTip>
              Jede Stufe filtert URLs: entdeckt → abrufbar → renderbar → nicht blockiert →
              indexierbar. Ein großer Abfall zwischen zwei Stufen ist ein konkreter Hebel.
            </InfoTip>
          </p>
          <p className="muted">
            Entdeckt → Gecrawlt → Indexierbar (aus dem letzten Crawl-Lauf). <ConfidenceBadge level="A" />
          </p>
          <IndexabilityFunnel stages={data.funnelStages} />
          <WhyItMatters>
            Jeder Abfall zwischen den Stufen ist Traffic, der nie im Index ankommt — hier wird er
            sichtbar.
          </WhyItMatters>
        </div>

        <div className="card">
          <p className="kicker">
            <TermTooltip term="health score">Health Score</TermTooltip>
          </p>
          <ScoreGauge value={healthValue} label="Health" />
          <div className="audit-gauge-row">
            {healthDelta !== null ? <DeltaChip value={healthDelta} unit=" Punkte" /> : null}
            <ConfidenceBadge level="A" />
          </div>
          <p className="muted">
            {data.latestHealthScore
              ? `${data.latestHealthScore.totalIssues} gewertete Issues · Stand ${new Date(
                  data.latestHealthScore.generatedAt
                ).toLocaleString("de-DE")}`
              : "Noch kein Health Score berechnet."}
          </p>
        </div>
      </section>

      {/* Section treemap */}
      <section className="card">
        <p className="kicker">Section-Health (Treemap)</p>
        <p className="muted">
          Website-Bereiche nach erstem Pfad-Segment; Kachelgröße = URL-Anzahl, Farbe = Health (Issue-Dichte).
          <ConfidenceBadge level="A" />
        </p>
        <SectionTreemap sections={data.sections} />
        {data.sections.length > 0 ? (
          <div className="audit-treemap-legend" aria-hidden="true">
            <span className="audit-treemap-legend__item">
              <span className="audit-treemap-legend__swatch" style={{ background: "var(--success)" }} /> gesund (≥70)
            </span>
            <span className="audit-treemap-legend__item">
              <span className="audit-treemap-legend__swatch" style={{ background: "var(--warning)" }} /> auffällig (40–69)
            </span>
            <span className="audit-treemap-legend__item">
              <span className="audit-treemap-legend__swatch" style={{ background: "var(--danger)" }} /> kritisch (&lt;40)
            </span>
          </div>
        ) : null}
        <WhyItMatters>
          Zeigt auf einen Blick, welche Bereiche der Website die meisten Probleme tragen.
        </WhyItMatters>
      </section>

      {/* Issue groups */}
      <section className="card">
        <p className="kicker">Issue-Gruppen</p>
        <p className="muted">
          {isDefaultIssueFilter(data.activeIssueFilter)
            ? `${data.openIssueTotal.toLocaleString("de-DE")} offene Issues`
            : `${data.displayedIssueTotal.toLocaleString("de-DE")} Issues im aktiven Filter`}
          , gruppiert nach Regel und Schweregrad und nach Impact (Anzahl × Schweregrad-Gewicht)
          sortiert. <ConfidenceBadge level="A" />
        </p>
        <IssueFilterBar active={data.activeIssueFilter} />
        <IssueGroups groups={data.issueGroups} />
      </section>

      {/* Recent crawl runs */}
      <section className="card">
        <p className="kicker">Letzte Crawl-Läufe</p>
        {data.recentCrawlRuns.length > 0 ? (
          <div className="audit-runs">
            {data.recentCrawlRuns.map((run) => (
              <div className="audit-run" key={run.id}>
                <div className="audit-run__meta">
                  <span className="audit-run__when">
                    {new Date(run.startedAt).toLocaleString("de-DE")} · {run.trigger}
                  </span>
                  <span className="audit-run__detail">
                    {run.summary.discoveredUrls.toLocaleString("de-DE")} URLs entdeckt ·{" "}
                    {run.summary.openIssues.toLocaleString("de-DE")} offene Issues
                    {run.summary.healthScore !== null ? ` · Health ${run.summary.healthScore}` : ""}
                  </span>
                </div>
                <span
                  className={`badge ${
                    run.status === "succeeded"
                      ? "success"
                      : run.status === "failed"
                        ? "danger"
                        : "primary"
                  }`}
                >
                  {RUN_STATUS_LABEL[run.status] ?? run.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Noch kein Crawl-Lauf. Starten Sie einen Crawl, um Indexierbarkeit und Issues zu erfassen.
          </p>
        )}
      </section>
    </AppShell>
  );
}
