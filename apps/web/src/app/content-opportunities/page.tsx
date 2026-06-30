import "../../features/content-opportunities/board.css";

import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { HeroBand } from "../../components/hero-band";
import { Icon } from "../../components/icon";
import { MetricCard } from "../../components/metric-card";
import { WhyItMatters } from "../../components/why-it-matters";
import { OpportunityBoardClient } from "../../features/content-opportunities";
import { loadOpportunityBoard } from "../../lib/board-api";
import { actionLock, type ReadinessState } from "../../lib/readiness";
import {
  bulkTransitionOpportunitiesAction,
  generateOpportunitiesAction,
  syncSearchPerformanceAction,
} from "./actions";
import type { OpportunityStatus } from "@seo-tool/domain-model";
import { opportunityStatusLabel } from "../../lib/board-logic";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await loadOpportunityBoard();
  const feedback = feedbackMessage(params);

  const opportunities = data.opportunities;
  const openCount = opportunities.filter(
    (o) => !["validated", "dismissed", "expired"].includes(o.status)
  ).length;
  const validatedCount = opportunities.filter((o) => o.status === "validated").length;
  // Same boundary as the PriorityMatrix "Quick Wins" quadrant (impact ≥ 3, effort < 3) so the
  // KPI count matches the highlighted bubbles.
  const quickWins = opportunities.filter((o) => o.expectedImpact >= 3 && o.effort <= 2).length;
  const topPriority = [...opportunities].sort((a, b) => b.priority - a.priority)[0] ?? null;

  // Action gating: opportunities are generated from crawl data, so the hero actions need a
  // project + site + crawl. Use the same readiness helper that drives nav locks + banners so the
  // disabled reason is consistent. (Data-source connection is an optional booster, not a gate.)
  const readiness: ReadinessState = {
    hasProject: Boolean(data.selectedProject),
    hasSite: Boolean(data.selectedSite),
    hasIntegration: false,
    hasCrawl: data.hasCrawl,
  };
  const heroLock = actionLock(readiness, ["project", "site", "crawl"]);
  const lockReason = !data.connected ? "Daten momentan nicht erreichbar." : heroLock.reason;
  const heroDisabled = !data.connected || heroLock.locked;

  return (
    <AppShell activePath="/content-opportunities">
      <section className="card hero-card">
        <HeroBand src="/brand/hdr-content-opportunities.jpg" />
        <p className="kicker">Content &amp; Chancen</p>
        <h1>Optimierungschancen</h1>
        <p>
          Konkrete Verbesserungen für Ihre Website, nach Wirkung sortiert. Jede Chance folgt dem
          Muster: Beobachtung → Evidenz → Maßnahme → messbares Ergebnis.
        </p>
        <WhyItMatters>
          Die Wirkung-/Aufwand-Matrix zeigt die günstigsten Hebel zuerst — schnelle Erfolge vor großen Projekten.
        </WhyItMatters>
        <div className="badge-row">
          <span className={data.connected ? "badge success" : "badge danger"}>
            {data.connected ? "Daten verbunden" : "Daten offline"}
          </span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <OfflineNotice /> : null}
        <div className="action-row">
          <div className="locked-action">
            <form action={generateOpportunitiesAction}>
              <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
              <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
              <button className="button" type="submit" disabled={heroDisabled}>
                Alle Optimierungschancen erzeugen
              </button>
            </form>
            <div className="locked-action">
              <form action={syncSearchPerformanceAction}>
                <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
                <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
                <button className="button secondary" type="submit" disabled={heroDisabled || !data.hasIntegration}>
                  Search Performance synchronisieren
                </button>
              </form>
              {/* Search-Performance sync pulls clicks/impressions from GSC — without a connected source it
                  would do nothing, so gate it honestly instead of offering a silent no-op. */}
              {!heroDisabled && !data.hasIntegration ? (
                <span className="locked-action__reason">
                  <Icon name="lock" />
                  Zuerst Google Search Console verbinden — dann liefert die Synchronisierung echte Klick- und Ranking-Daten.
                </span>
              ) : null}
            </div>
            {heroDisabled && lockReason ? (
              <span className="locked-action__reason">
                <Icon name="lock" />
                {lockReason}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Opportunities" value={String(data.meta.total)} note={`${opportunities.length} geladen`} />
        <MetricCard label="Aktiv (offen)" value={String(openCount)} note="nicht validiert/dismissed/expired" />
        <MetricCard label="Quick Wins" value={String(quickWins)} note="hohe Wirkung, niedriger Aufwand" />
        <MetricCard
          label="Validiert"
          value={String(validatedCount)}
          note={topPriority ? `Top-Prio ${topPriority.priority}` : "Vorher/Nachher bestätigt"}
        />
      </section>

      <OpportunityBoardClient
        opportunities={opportunities}
        onBulkTransition={bulkTransitionOpportunitiesAction}
      />
    </AppShell>
  );
}

function feedbackMessage(
  params: Record<string, string | string[] | undefined> | undefined
): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.generated)) {
    return { kind: "success", message: "Optimierungschancen erzeugt." };
  }
  if (singleParam(params?.synced)) {
    return { kind: "success", message: "Such-Performance aus der Google Search Console abgeglichen. Neue Klick- und Ranking-Daten fließen in die Optimierungschancen ein." };
  }
  if (singleParam(params?.revalidated)) {
    return { kind: "success", message: "Chance erneut geprüft (validiert oder wieder geöffnet)." };
  }
  const transition = singleParam(params?.transition);
  if (transition) return { kind: "success", message: `Status geändert: ${opportunityStatusLabel(transition as OpportunityStatus)}.` };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
