import "../../features/content-opportunities/board.css";

import { AppShell } from "../../components/app-shell";
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
  const quickWins = opportunities.filter((o) => o.expectedImpact >= 4 && o.effort <= 2).length;
  const topPriority = [...opportunities].sort((a, b) => b.priority - a.priority)[0] ?? null;

  // Action gating: both hero actions need a project + site (real prerequisites
  // for generating opportunities / syncing performance). Use the same readiness
  // helper that drives nav locks + banners so the disabled reason is consistent.
  const readiness: ReadinessState = {
    hasProject: Boolean(data.selectedProject),
    hasSite: Boolean(data.selectedSite),
    hasIntegration: data.connected,
    hasCrawl: false,
  };
  const heroLock = actionLock(readiness, ["project", "site"]);
  const lockReason = !data.connected ? "API nicht erreichbar." : heroLock.reason;
  const heroDisabled = !data.connected || heroLock.locked;

  return (
    <AppShell activePath="/content-opportunities">
      <section className="card hero-card">
        <p className="kicker">Content &amp; Opportunities</p>
        <h1>Opportunity Board</h1>
        <p>
          Priorisierte Optimierungschancen mit Evidenz, Maßnahmen und Validierung. Jede Chance folgt dem
          Muster: Beobachtung → Ursache → Maßnahme → messbares Ergebnis.
        </p>
        <WhyItMatters>
          Die Impact×Effort-Matrix zeigt die günstigsten Hebel zuerst — Quick Wins vor Big Bets.
        </WhyItMatters>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.selectedSite?.baseUrl ?? "keine Site"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>
            {data.connected ? "API verbunden" : "API offline"}
          </span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? (
          <p className="notice danger">
            {data.errorMessage ?? "API nicht erreichbar."} · Erwartete API: {data.apiBaseUrl}
          </p>
        ) : null}
        <div className="action-row">
          <div className="locked-action">
            <form action={generateOpportunitiesAction}>
              <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
              <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
              <button className="button" type="submit" disabled={heroDisabled}>
                Alle Opportunity-Klassen generieren
              </button>
            </form>
            <form action={syncSearchPerformanceAction}>
              <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
              <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
              <button className="button secondary" type="submit" disabled={heroDisabled}>
                Search Performance synchronisieren
              </button>
            </form>
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
    return { kind: "success", message: "Opportunities generiert (alle Klassen, idempotent)." };
  }
  if (singleParam(params?.synced)) {
    return { kind: "success", message: "Search-Performance synchronisiert (GSC-Stub, Klasse B)." };
  }
  if (singleParam(params?.revalidated)) {
    return { kind: "success", message: "Opportunity re-validiert (validated oder reopened)." };
  }
  const transition = singleParam(params?.transition);
  if (transition) return { kind: "success", message: `Status gewechselt zu ${transition}.` };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
