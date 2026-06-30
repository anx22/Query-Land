import "../../features/url-dossier/dossier.css";

import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { HeroBand } from "../../components/hero-band";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { TermTooltip } from "../../components/term-tooltip";
import { WhyItMatters } from "../../components/why-it-matters";
import { Sparkline } from "../../components/charts/sparkline";
import { loadUrlDossier } from "../../lib/dossier-api";
import { EmptyLine, SectionCard } from "../../features/url-dossier/section-card";
import {
  formatCount,
  formatCtr,
  formatDateTime,
  formatPosition,
  severityVariant
} from "../../features/url-dossier/format";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const url = singleParam(params?.pageUrl) ?? singleParam(params?.url);
  const data = await loadUrlDossier({ url });

  return (
    <AppShell activePath="/url-dossier">
      <section className="card hero-card">
        <HeroBand src="/brand/hdr-url-dossier.jpg" />
        <p className="kicker">Eine Seite, alle SEO-Infos</p>
        <h1>URL-Dossier</h1>
        <p>
          Alles zu einer einzelnen Seite an einem Ort: ob Google sie findet
          (<TermTooltip term="indexierbarkeit">Indexierbarkeit</TermTooltip>), wie sie in der Suche
          läuft, ihre Rankings, interne und externe Links, Ladewerte (Web Vitals), Probleme und
          Chancen — inklusive Hinweis auf die zuständige{" "}
          <TermTooltip term="quell-verknüpfung">Code-Stelle</TermTooltip>.
        </p>
        <div className="badge-row">
          <span className={data.connected ? "badge success" : "badge danger"}>
            {data.connected ? "Daten verbunden" : "Daten offline"}
          </span>
        </div>
        {!data.connected ? <OfflineNotice /> : null}
        {data.urlOptions.length > 0 ? (
          <form className="filter-row" action="/url-dossier">
            <label>
              URL
              <select name="pageUrl" defaultValue={data.selectedUrl ?? ""}>
                {data.urlOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">
              Öffnen
            </button>
          </form>
        ) : (
          <p className="notice">
            Für diese Website wurden noch keine Seiten gefunden. Starten Sie zuerst eine Analyse —{" "}
            <a href="/technical-audit#crawl-start">zum Technical Audit →</a>
          </p>
        )}
      </section>

      {data.selectedUrl ? (
        <>
          {/* 1 — Identität + Quell-Verknüpfung */}
          <section className="content-grid">
            <SectionCard
              num={1}
              title={
                <>
                  Identität &amp; <TermTooltip term="quell-verknüpfung">Quell-Verknüpfung</TermTooltip>
                </>
              }
              confidence="A"
            >
              <div className="table-list">
                <article>
                  <strong className="dossier-mono">{data.selectedUrl}</strong>
                  {data.discoveredUrl ? (
                    <div className="facts">
                      <span className="fact"><span className="fact__label">Quelle</span><span className="fact__value">{data.discoveredUrl.source}</span></span>
                      <span className="fact"><span className="fact__label">Tiefe</span><span className="fact__value">{data.discoveredUrl.depth}</span></span>
                      <span className="fact"><span className="fact__label">Entdeckt</span><span className="fact__value">{formatDateTime(data.discoveredUrl.discoveredAt)}</span></span>
                    </div>
                  ) : (
                    <span className="dossier-muted">keine Discovery-Daten</span>
                  )}
                </article>
                <article>
                  <strong>Quell-Verknüpfung</strong>
                  {data.sourceAnchor ? (
                    <div className="facts">
                      <span className="fact"><span className="fact__label">Vorlage</span><span className="fact__value">{data.sourceAnchor.template}</span></span>
                      <span className="fact"><span className="fact__label">Komponente</span><span className="fact__value">{data.sourceAnchor.component}</span></span>
                      <span className="fact"><span className="fact__label">Datei</span><span className="fact__value dossier-mono">{data.sourceAnchor.repoPath}</span></span>
                      <span className="fact"><span className="fact__label">Konfidenz</span><span className="fact__value">{data.sourceAnchor.confidence}</span></span>
                    </div>
                  ) : (
                    <EmptyLine>
                      Noch keiner Code-Stelle zugeordnet. <a href="/settings">In den Einstellungen
                      eine URL→Code-Zuordnung anlegen →</a>
                    </EmptyLine>
                  )}
                </article>
              </div>
            </SectionCard>

            {/* 2 — Fetch / Indexierbarkeit + Mini-Timeline */}
            <SectionCard
              num={2}
              title={
                <>
                  Fetch / <TermTooltip term="indexierbarkeit">Indexierbarkeit</TermTooltip>
                </>
              }
              confidence="A"
            >
              <div className="dossier-kpis">
                <div className="dossier-kpi">
                  <span className="dossier-kpi-label">HTTP-Status</span>
                  <span className="dossier-kpi-value">
                    {data.latestFetch ? String(data.latestFetch.statusCode ?? "network") : "—"}
                  </span>
                </div>
                <div className="dossier-kpi">
                  <span className="dossier-kpi-label">Indexierbar</span>
                  <span className="dossier-kpi-value">
                    {data.latestIndexability ? (data.latestIndexability.isIndexable ? "ja" : "nein") : "—"}
                  </span>
                </div>
              </div>
              {data.latestIndexability?.reasons?.length ? (
                <p className="dossier-muted">{data.latestIndexability.reasons.join(", ")}</p>
              ) : null}

              <p className="kicker">Verlauf</p>
              {data.fetchHistory.length > 0 || data.indexabilityHistory.length > 0 ? (
                <ul className="dossier-timeline">
                  {data.fetchHistory.slice(0, 5).map((record) => (
                    <li
                      key={`f-${record.id}`}
                      className={record.statusClass === "success" || record.statusClass === "redirect" ? "dossier-tl-ok" : "dossier-tl-bad"}
                    >
                      <strong>
                        Fetch · {record.statusClass} · {record.statusCode ?? "network"}
                      </strong>
                      <span className="dossier-timeline-when">{formatDateTime(record.fetchedAt)}</span>
                      {record.errorMessage ? <span className="dossier-muted">{record.errorMessage}</span> : null}
                    </li>
                  ))}
                  {data.indexabilityHistory.slice(0, 5).map((record) => (
                    <li key={`i-${record.id}`} className={record.isIndexable ? "dossier-tl-ok" : "dossier-tl-bad"}>
                      <strong>
                        Indexierbarkeit · {record.state} · {record.isIndexable ? "indexierbar" : "blockiert"}
                      </strong>
                      <span className="dossier-timeline-when">{formatDateTime(record.assessedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>Noch keine Fetch- oder Indexierbarkeits-Bewertungen.</EmptyLine>
              )}
            </SectionCard>
          </section>

          {/* 3 — GSC-Leistung · 4 — Rankings/Queries */}
          <section className="content-grid">
            <SectionCard num={3} title="GSC-Leistung" confidence="B">
              <WhyItMatters>
                Klicks, Impressionen und Position zeigen, ob diese URL bei Google tatsächlich Nachfrage gewinnt.
              </WhyItMatters>
              {data.gsc ? (
                <>
                  <div className="dossier-kpis">
                    <div className="dossier-kpi">
                      <span className="dossier-kpi-label">Klicks</span>
                      <span className="dossier-kpi-value">{formatCount(data.gsc.clicks)}</span>
                    </div>
                    <div className="dossier-kpi">
                      <span className="dossier-kpi-label">Impressionen</span>
                      <span className="dossier-kpi-value">{formatCount(data.gsc.impressions)}</span>
                    </div>
                    <div className="dossier-kpi">
                      <span className="dossier-kpi-label">CTR</span>
                      <span className="dossier-kpi-value">{formatCtr(data.gsc.ctr)}</span>
                    </div>
                    <div className="dossier-kpi">
                      <span className="dossier-kpi-label">Ø Position</span>
                      <span className="dossier-kpi-value">{formatPosition(data.gsc.position)}</span>
                    </div>
                  </div>
                  <div className="dossier-spark-row">
                    <div className="dossier-spark-cell">
                      <span className="dossier-kpi-label">Klicks-Trend</span>
                      <div className="dossier-spark">
                        <Sparkline data={data.gsc.clicksTrend} ariaLabel="Klicks-Trend dieser URL" />
                      </div>
                    </div>
                    <div className="dossier-spark-cell">
                      <span className="dossier-kpi-label">Positions-Trend</span>
                      <div className="dossier-spark">
                        <Sparkline data={data.gsc.positionTrend} ariaLabel="Positions-Trend dieser URL" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyLine>
                  Noch keine Klick- und Ranking-Daten für diese Seite.{" "}
                  <a href="/settings">Google Search Console verbinden →</a>
                </EmptyLine>
              )}
            </SectionCard>

            <SectionCard num={4} title="Rankings / Queries" confidence="C">
              {data.rankings.length > 0 ? (
                <div className="table-list">
                  {data.rankings.map((row) => (
                    <article key={row.keyword.id}>
                      <div className="dossier-row">
                        <span className="dossier-row-main">{row.keyword.phrase}</span>
                        <span className="dossier-row-metrics">
                          <span>Pos. {formatPosition(row.latest?.position ?? null)}</span>
                          {row.positionTrend.length > 1 ? (
                            <span className="dossier-spark dossier-spark--compact">
                              <Sparkline data={row.positionTrend} ariaLabel={`Positions-Trend für ${row.keyword.phrase}`} />
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="facts">
                        <span className="fact"><span className="fact__label">Intent</span><span className="fact__value">{row.keyword.intent}</span></span>
                        <span className="fact"><span className="fact__label">Markt</span><span className="fact__value">{row.keyword.market}</span></span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyLine>
                  Noch keine Keywords für diese Seite hinterlegt.{" "}
                  <a href="/keywords-rank">In „Keywords &amp; Rankings“ eine Ziel-URL zuordnen →</a>
                </EmptyLine>
              )}
            </SectionCard>
          </section>

          {/* 5 — interne Links · 6 — externe Links */}
          <section className="content-grid">
            <SectionCard
              num={5}
              title={<TermTooltip term="interne verlinkung">Interne Verlinkung</TermTooltip>}
              confidence="A"
            >
              <div className="table-list">
                <article>
                  <strong>Inlinks ({data.inlinks.length})</strong>
                  {data.inlinks.slice(0, 8).map((edge) => (
                    <span key={edge.id} className="dossier-mono">
                      {edge.fromUrl}
                      {edge.anchor ? ` · „${edge.anchor}"` : ""}
                    </span>
                  ))}
                  {data.inlinks.length === 0 ? (
                    <EmptyLine>
                      Keine eingehenden internen Links — potenzielle <TermTooltip term="orphan-url">Orphan-URL</TermTooltip>.
                    </EmptyLine>
                  ) : null}
                </article>
                <article>
                  <strong>Outlinks ({data.outlinks.length})</strong>
                  {data.outlinks.slice(0, 8).map((edge) => (
                    <span key={edge.id} className="dossier-mono">
                      {edge.toUrl}
                    </span>
                  ))}
                  {data.outlinks.length === 0 ? <EmptyLine>Keine ausgehenden internen Links erfasst.</EmptyLine> : null}
                </article>
              </div>
            </SectionCard>

            <SectionCard
              num={6}
              title={
                <>
                  Externe Links (<TermTooltip term="backlink">Backlinks</TermTooltip> auf URL)
                </>
              }
              confidence="B"
            >
              {data.backlinks.length > 0 ? (
                <div className="table-list">
                  {data.backlinks.slice(0, 10).map((link) => (
                    <article key={link.id}>
                      <div className="dossier-row">
                        <span className="dossier-row-main dossier-mono">{link.sourceDomain}</span>
                        <span className="dossier-row-metrics">
                          <span className={`badge ${link.linkType === "follow" ? "success" : ""}`}>{link.linkType}</span>
                        </span>
                      </div>
                      <span className="dossier-muted">{link.anchorText || "(kein Ankertext)"}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyLine>Keine Backlinks zeigen auf diese URL (oder noch kein Backlink-Snapshot importiert).</EmptyLine>
              )}
            </SectionCard>
          </section>

          {/* 7 — Web Vitals · 8 — Issues */}
          <section className="content-grid">
            <SectionCard
              num={7}
              title={<TermTooltip term="Web Vitals (LCP/CLS/INP/TTFB)">Web Vitals</TermTooltip>}
              confidence="B"
            >
              {data.webVitals.length > 0 ? (
                <div className="dossier-kpis">
                  {data.webVitals.map((vital) => (
                    <div className="dossier-kpi" key={vital.metric}>
                      <span className="dossier-kpi-label">{vital.metric.toUpperCase()}</span>
                      <span className="dossier-kpi-value">{vital.value.toLocaleString("de-DE")}</span>
                      <span className="dossier-muted">{formatDateTime(vital.measuredAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine>Keine Web-Vitals-Messung vorhanden. Hinweis: Werte sind site-skopiert, nicht je URL.</EmptyLine>
              )}
            </SectionCard>

            <SectionCard num={8} title="Issues auf dieser URL" confidence="A">
              {data.issues.length > 0 ? (
                <div className="table-list">
                  {data.issues.map((issue) => (
                    <article key={issue.id}>
                      <div className="dossier-row">
                        <strong className="dossier-row-main">{issue.rule}</strong>
                        <span className="dossier-row-metrics">
                          <span className={`badge ${severityVariant(issue.severity) === "danger" ? "danger" : ""}`}>
                            {issue.severity}
                          </span>
                          <span className={`status ${issue.resolvedAt ? "succeeded" : "running"}`}>
                            {issue.resolvedAt ? "behoben" : "offen"}
                          </span>
                        </span>
                      </div>
                      <span className="dossier-muted">{issue.message}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyLine>Keine Issues auf dieser URL.</EmptyLine>
              )}
            </SectionCard>
          </section>

          {/* 9 — Chancen */}
          <section className="content-grid">
            <SectionCard num={9} title={<TermTooltip term="chance (opportunity)">Chancen</TermTooltip>} confidence="C">
              {data.opportunities.length > 0 ? (
                <div className="table-list">
                  {data.opportunities.map((opportunity) => (
                    <article key={opportunity.id}>
                      <div className="dossier-row">
                        <strong className="dossier-row-main">{opportunity.type}</strong>
                        <span className="dossier-row-metrics">
                          <span>Prio {formatCount(opportunity.priority)}</span>
                          <span className={`status ${opportunity.status}`}>{opportunity.status}</span>
                          {opportunity.evidence[0] ? (
                            <ConfidenceBadge level={evidenceLevel(opportunity.evidence[0].sourceConfidence)} showLabel={false} />
                          ) : null}
                        </span>
                      </div>
                      <span className="dossier-muted">{opportunity.recommendedAction}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyLine>Keine Chancen für diese URL.</EmptyLine>
              )}
            </SectionCard>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Coerces a raw source-confidence string into a ConfidenceBadge level (A..E). */
function evidenceLevel(value: string): "A" | "B" | "C" | "D" | "E" {
  const upper = (value ?? "").toUpperCase();
  return upper === "A" || upper === "B" || upper === "C" || upper === "D" || upper === "E" ? upper : "E";
}
