import "../../features/backlinks/backlinks.css";

import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { ConnectionBadge } from "../../components/connection-badge";
import { MetricCard } from "../../components/metric-card";
import { HelpDisclosure } from "../../components/help-disclosure";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { DeltaChip } from "../../components/delta-chip";
import { TermTooltip } from "../../components/term-tooltip";
import { WhyItMatters } from "../../components/why-it-matters";
import { InfoTip } from "../../components/info-tip";
import { GlossarLink } from "../../components/glossar-link";
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
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <header className="page-header">
          <div className="page-header__titles">
            <p className="kicker">Verlinkung von anderen Websites</p>
            <h1>Backlink-Profil</h1>
            <p className="page-header__purpose">
              Backlinks sind Links von anderen Websites auf Ihre — ein wichtiges Vertrauenssignal für
              Google. So entwickelt sich Ihr Linkprofil über die Zeit.
            </p>
          </div>
          <div className="page-header__aside">
            {data.snapshots.length > 0 ? (
              <span className="badge">{data.snapshots.length} Momentaufnahme{data.snapshots.length !== 1 ? "n" : ""}</span>
            ) : null}
            {/* Only claim a confidence class once there is something measured. With no data, say
                "Bald verfügbar" — the same honest coming-soon treatment as GA4 in den Einstellungen. */}
            {hasData ? <ConfidenceBadge level="B" /> : <span className="badge warning">Bald verfügbar</span>}
            <ConnectionBadge connected={data.connected} />
          </div>
        </header>

        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <OfflineNotice /> : null}
        {/* No dead "Backlinks importieren" button: there is no backlink source yet (Google offers
            none via API), so a permanently-disabled action would be a dead-end. Instead set the
            expectation honestly and make clear nothing is blocked on the user. */}
        {data.connected && !hasData ? (
          <p className="notice">
            <strong>Backlink-Anbindung folgt.</strong> Google stellt Backlinks nicht über seine
            Schnittstelle bereit — dafür binden wir eine eigene Backlink-Quelle an. Sobald sie
            verfügbar ist, erscheinen hier Ihr Linkprofil, die verweisenden Domains und ihre
            Entwicklung über die Zeit. Von Ihrer Seite ist dafür kein Schritt nötig.
          </p>
        ) : null}

        <HelpDisclosure summary="So lesen Sie das Backlink-Profil">
          <p>
            Backlinks sind Links von anderen Websites auf Ihre — ein wichtiges Vertrauenssignal für
            Google. So entwickelt sich Ihr Linkprofil: <TermTooltip term="Backlink">Backlinks</TermTooltip> und{" "}
            <TermTooltip term="Verweisende Domain">verweisende Domains</TermTooltip> über die Zeit,{" "}
            <TermTooltip term="Follow / Nofollow">Follow / Nofollow</TermTooltip>-Mix, Zu- und Abgänge sowie die{" "}
            <TermTooltip term="Follow-Ratio">Follow-Ratio</TermTooltip>.
          </p>
        </HelpDisclosure>

        {/* Two-mode: the verdict/trend/gauge/flow/distribution/table machinery only renders once
            there is real backlink data; until then the header above already explains the no-source
            state. */}
        {hasData && (
        <>
        {/* At-a-glance verdict: the three numbers that frame the profile */}
        <div className="verdict-strip verdict-strip--3">
          <MetricCard
            label="Backlinks"
            value={formatCount(totalBacklinks)}
            note="eingehende Links gesamt"
            info="Alle eingehenden Links, die Google Search Console meldet (verlässliche Quelle)."
          />
          <MetricCard
            label="Verweisende Domains"
            value={formatCount(deltas.latest?.referringDomains)}
            note="unterschiedliche Domains, die verlinken"
            info="Viele unterschiedliche verweisende Domains wiegen schwerer als viele Links von wenigen Domains."
          />
          <MetricCard
            label="Follow-Ratio"
            value={formatRatioPct(followRatio)}
            note="Anteil linkkraft-weitergebender Links"
            info="Anteil der Follow-Links am Gesamtprofil — der Teil, der tatsächlich Authority überträgt."
          />
        </div>

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
        {/* Referring-domains table (primary) + Anchor distribution (rail)    */}
        {/* ----------------------------------------------------------------- */}
        <div className="split-lead">
          <section className="card" aria-label="Verweisende Domains">
            <p className="kicker">
              <TermTooltip term="Verweisende Domain">Verweisende Domains</TermTooltip>
            </p>
            <h2>Domains, die auf Sie verlinken</h2>
            <WhyItMatters text="Viele unterschiedliche verweisende Domains wiegen schwerer als viele Links von wenigen Domains." />
            <ReferringDomainsTable domains={data.referringDomains} />
          </section>

          <div className="side-rail">
            <section className="card" aria-label="Anchor-Verteilung">
              <p className="kicker">Anchor-Verteilung</p>
              <h2>Häufigste Ankertexte</h2>
              <WhyItMatters text="Ein natürlicher Anchor-Mix (Brand, URL, generisch) schützt vor Over-Optimization-Risiken." />
              <AnchorDistribution authority={data.authority} />
            </section>
          </div>
        </div>
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
