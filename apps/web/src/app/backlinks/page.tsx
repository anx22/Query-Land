import "../../features/backlinks/backlinks.css";

import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { ConnectionBadge } from "../../components/connection-badge";
import { HeroBand } from "../../components/hero-band";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { DeltaChip } from "../../components/delta-chip";
import { TermTooltip } from "../../components/term-tooltip";
import { WhyItMatters } from "../../components/why-it-matters";
import { InfoTip } from "../../components/info-tip";
import { GlossarLink } from "../../components/glossar-link";
import { Icon } from "../../components/icon";
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

  // The /authority endpoint always returns a (zeroed) summary even with no links, so guard on real
  // volume — otherwise an unmeasured profile renders a confident "0 %" follow-ratio as if verified.
  const totalBacklinks = data.authority?.totalBacklinks ?? 0;
  const followRatio = totalBacklinks > 0 ? data.authority?.followRatio ?? null : null;
  // ScoreGauge expects a 0–100 value; follow-ratio is a 0–1 fraction.
  const followRatioGauge = followRatio !== null ? Math.round(followRatio * 100) : null;

  const hasData = totalBacklinks > 0 || data.snapshots.length > 0;

  return (
    <AppShell activePath="/backlinks">
      <div className="backlinks-root">
        {/* ----------------------------------------------------------------- */}
        {/* Intro + import action                                             */}
        {/* ----------------------------------------------------------------- */}
        <section className="card hero-card">
          <HeroBand src="/brand/hdr-backlinks.jpg" />
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
            <ConnectionBadge connected={data.connected} />
          </div>
          {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
          {!data.connected ? <OfflineNotice /> : null}
          {data.connected && !hasData ? (
            <p className="notice">
              Noch keine Backlink-Daten. Eine echte Backlink-Quelle ist noch nicht angebunden —
              Google Search Console stellt Backlinks nicht über die Schnittstelle bereit.
            </p>
          ) : null}
          <div className="action-row">
            <div className="locked-action">
              <button className="button" type="button" disabled>Backlinks importieren</button>
              <span className="locked-action__reason">
                <Icon name="lock" />
                Backlinks-Quelle noch nicht verfügbar — Google liefert keine Backlinks per API.
              </span>
            </div>
          </div>
        </section>

        {/* Two-mode: the trend/gauge/flow/distribution/table machinery only renders once there
            is real backlink data; until then the hero above already explains the no-source state. */}
        {hasData && (
        <>
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
                      Alle eingehenden Links, die Google Search Console meldet (verlässliche Quelle).
                      Siehe <GlossarLink term="Backlink">Backlink</GlossarLink>.
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
              <>
                <div className="facts">
                  <span className="fact">
                    <span className="fact__label">Netto Links</span>
                    <span className="fact__value"><DeltaChip value={data.diff.netBacklinkChange} /></span>
                  </span>
                  <span className="fact">
                    <span className="fact__label">Netto Domains</span>
                    <span className="fact__value"><DeltaChip value={data.diff.netReferringDomainChange} /></span>
                  </span>
                </div>
                <p className="muted">seit dem letzten Snapshot.</p>
              </>
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
        </>
        )}
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
