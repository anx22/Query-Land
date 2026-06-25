import "../../features/backlinks/backlinks.css";

import { AppShell } from "../../components/app-shell";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { DeltaChip } from "../../components/delta-chip";
import { TermTooltip } from "../../components/term-tooltip";
import { WhyItMatters } from "../../components/why-it-matters";
import { InfoTip } from "../../components/info-tip";
import { GlossarLink } from "../../components/glossar-link";
import { Icon } from "../../components/icon";
import { PREREQUISITE_META } from "../../lib/readiness";
import { ScoreGauge } from "../../components/charts/score-gauge";
import { BacklinkFlowChart } from "../../components/charts/backlink-flow";
import { loadBacklinksScreenData } from "../../lib/backlinks-api";
import {
  backlinkTrend,
  diffToFlowBars,
  formatCount,
  formatRatioPct,
  referringDomainTrend,
  snapshotDeltas,
} from "../../features/backlinks/backlinks-logic";
import { BacklinkTrendCard } from "../../features/backlinks/backlink-trend-card";
import { ReferringDomainsTable } from "../../features/backlinks/referring-domains-table";
import { AnchorDistribution, FollowDistribution } from "../../features/backlinks/distribution-bars";
import { importBacklinksAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadBacklinksScreenData();
  const feedback = feedbackMessage(params);

  // Server-derived, serialisable props for client islands.
  const backlinksTrend = backlinkTrend(data.snapshots);
  const domainsTrend = referringDomainTrend(data.snapshots);
  const flowBars = diffToFlowBars(data.diff);
  const deltas = snapshotDeltas(data.snapshots);

  const followRatio = data.authority?.followRatio ?? null;
  // ScoreGauge expects a 0–100 value; follow-ratio is a 0–1 fraction.
  const followRatioGauge = followRatio !== null ? Math.round(followRatio * 100) : null;

  const hasData = data.authority !== null || data.snapshots.length > 0;

  return (
    <AppShell activePath="/backlinks">
      <div className="backlinks-root">
        {/* ----------------------------------------------------------------- */}
        {/* Intro + import action                                             */}
        {/* ----------------------------------------------------------------- */}
        <section className="card hero-card">
          <p className="kicker">Verlinkung von anderen Websites</p>
          <h1>Backlink-Profil</h1>
          <p>
            Backlinks sind Links von anderen Websites auf Ihre — ein wichtiges Vertrauenssignal für
            Google. So entwickelt sich Ihr Linkprofil: <TermTooltip term="Backlink">Backlinks</TermTooltip> und{" "}
            <TermTooltip term="Verweisende Domain">verweisende Domains</TermTooltip> über die Zeit,{" "}
            <TermTooltip term="Follow / Nofollow">Follow / Nofollow</TermTooltip>-Mix, Zu- und Abgänge sowie die{" "}
            <TermTooltip term="Follow-Ratio">Follow-Ratio</TermTooltip>.
          </p>
          <div className="badge-row">
            <span className="badge">{data.snapshots.length} Momentaufnahme{data.snapshots.length !== 1 ? "n" : ""}</span>
            <ConfidenceBadge level="B" />
            <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
          </div>
          {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
          {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
          {data.connected && !hasData ? (
            <p className="notice">Noch keine Backlink-Daten. Mit „Backlinks importieren“ legen Sie den ersten Snapshot an.</p>
          ) : null}
          <div className="action-row">
            <div className="locked-action">
              <form action={importBacklinksAction}>
                <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
                <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Backlinks importieren</button>
              </form>
              {!data.connected || !data.selectedProject ? (
                <span className="locked-action__reason">
                  <Icon name="lock" />
                  {!data.connected ? "API nicht erreichbar." : PREREQUISITE_META.project.reason}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Hero: TrendChart (toggle Backlinks/Domains) + Follow-Ratio gauge  */}
        {/* ----------------------------------------------------------------- */}
        <section className="backlinks-hero" aria-label="Verlauf und Follow-Ratio">
          <div className="card">
            <div className="backlinks-hero__header">
              <div>
                <p className="kicker">Verlauf</p>
                <h2>Backlinks &amp; verweisende Domains</h2>
                <WhyItMatters>
                  Ein stetig wachsendes Linkprofil ist ein starkes Vertrauenssignal — fallende Kurven verdienen eine Ursachenanalyse.
                </WhyItMatters>
              </div>
              {deltas.latest ? (
                <div className="backlinks-gauge-foot">
                  <span className="metric-value">{formatCount(deltas.latest.totalBacklinks)}</span>
                  {deltas.backlinkDelta !== null ? <DeltaChip value={deltas.backlinkDelta} /> : null}
                  <span className="backlinks-gauge-note">
                    Backlinks gesamt
                    <InfoTip label="Backlinks gesamt erklären">
                      Alle eingehenden Links aus dem GSC-Links-Report (Beleg-Klasse B). Siehe{" "}
                      <GlossarLink term="Backlink">Backlink</GlossarLink>.
                    </InfoTip>
                  </span>
                </div>
              ) : null}
            </div>
            <BacklinkTrendCard backlinks={backlinksTrend} domains={domainsTrend} />
          </div>

          <div className="card backlinks-gauge-card">
            <p className="kicker">
              <TermTooltip term="Follow-Ratio">Follow-Ratio</TermTooltip>
              <InfoTip label="Follow-Ratio erklären">
                Anteil der Follow-Links am Gesamtprofil — der Teil, der tatsächlich{" "}
                <GlossarLink term="Authority">Authority</GlossarLink> überträgt.
              </InfoTip>
            </p>
            <WhyItMatters>
              Der Anteil linkkraft-weitergebender Links zeigt, wie viel SEO-Wert Ihr Profil tatsächlich überträgt.
            </WhyItMatters>
            <div className="backlinks-chart">
              <ScoreGauge value={followRatioGauge} max={100} label="Follow %" size={160} />
            </div>
            <div className="backlinks-gauge-foot">
              <span className="backlinks-gauge-note">Follow-Anteil: {formatRatioPct(followRatio)}</span>
              <ConfidenceBadge level="B" />
              <span className="backlinks-gauge-note">
                <TermTooltip term="Authority">Authority</TermTooltip>/Domain-Rating: Drittanbieter-Daten noch nicht angebunden.
              </span>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* New vs. Lost (diverging) + KPI deltas                              */}
        {/* ----------------------------------------------------------------- */}
        <section className="content-grid" aria-label="Zu- und Abgänge">
          <div className="card">
            <p className="kicker">Zu- und Abgänge</p>
            <h2>Neu vs. verloren</h2>
            <WhyItMatters text="Verlorene Links rechtzeitig erkennen, bevor sie Rankings kosten." />
            <div className="backlinks-chart">
              <BacklinkFlowChart data={flowBars} title="Neue vs. verlorene Links und Domains" />
            </div>
            {data.diff ? (
              <p className="muted">
                Netto {data.diff.netBacklinkChange >= 0 ? `+${data.diff.netBacklinkChange}` : data.diff.netBacklinkChange} Links ·{" "}
                {data.diff.netReferringDomainChange >= 0 ? `+${data.diff.netReferringDomainChange}` : data.diff.netReferringDomainChange} Domains
                {" "}seit dem letzten Snapshot.
              </p>
            ) : (
              <p className="muted">Vergleich erscheint ab dem zweiten Snapshot.</p>
            )}
          </div>

          <div className="card">
            <p className="kicker">
              <TermTooltip term="Follow / Nofollow">Follow / Nofollow</TermTooltip>-Verteilung
            </p>
            <h2>Link-Typ-Mix</h2>
            <WhyItMatters text="Ein gesunder Follow-Anteil maximiert die übertragene Linkkraft." />
            <FollowDistribution authority={data.authority} />
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Anchor distribution                                               */}
        {/* ----------------------------------------------------------------- */}
        <section className="card" aria-label="Anchor-Verteilung">
          <p className="kicker">Anchor-Verteilung</p>
          <h2>Häufigste Ankertexte</h2>
          <WhyItMatters text="Ein natürlicher Anchor-Mix (Brand, URL, generisch) schützt vor Over-Optimization-Risiken." />
          <AnchorDistribution authority={data.authority} />
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Referring-domains table                                           */}
        {/* ----------------------------------------------------------------- */}
        <section className="card" aria-label="Verweisende Domains">
          <p className="kicker">
            <TermTooltip term="Verweisende Domain">Verweisende Domains</TermTooltip>
          </p>
          <h2>Domains, die auf Sie verlinken</h2>
          <WhyItMatters text="Viele unterschiedliche verweisende Domains wiegen schwerer als viele Links von wenigen Domains." />
          <ReferringDomainsTable domains={data.referringDomains} />
        </section>
      </div>
    </AppShell>
  );
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.imported)) return { kind: "success", message: "Backlink-Import gestartet. Der neue Snapshot ist in Kürze verfügbar." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
