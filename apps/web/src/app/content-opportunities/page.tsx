import "../../features/content-opportunities/board.css";

import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { ConnectionBadge } from "../../components/connection-badge";
import { Icon } from "../../components/icon";
import { SummaryHead } from "../../components/summary-head";
import { deriveOpportunitiesVerdict } from "../../lib/verdict";
import { WhyItMatters } from "../../components/why-it-matters";
import { HelpDisclosure } from "../../components/help-disclosure";
import { OpportunityBoardClient } from "../../features/content-opportunities";
import { ModulesPending } from "../../components/modules-pending";
import { NextStep } from "../../components/next-step";
import { SubmitButton } from "../../components/submit-button";
import { loadOpportunityBoard } from "../../lib/board-api";
import { actionLock, type ReadinessState } from "../../lib/readiness";
import {
  bulkTransitionOpportunitiesAction,
  generateOpportunitiesAction,
  revalidateOpportunityAction,
  syncSearchPerformanceAction,
  transitionOpportunityAction,
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
  const heroDisabled = !data.connected || heroLock.locked;

  return (
    <AppShell activePath="/content-opportunities">
      {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
      {!data.connected ? <OfflineNotice /> : null}

      <header className="page-header">
        <div className="page-header__titles">
          <p className="kicker">Content &amp; Chancen</p>
          <h1>Optimierungschancen</h1>
          <p className="page-header__purpose">
            Konkrete Verbesserungen für Ihre Website, nach Wirkung sortiert. Jede Chance folgt dem
            Muster: Beobachtung → Evidenz → Maßnahme → messbares Ergebnis.
          </p>
        </div>
        <div className="page-header__aside">
          <ConnectionBadge connected={data.connected} />
          {/* Only show the generate/sync actions once an analysis exists. Before that the readiness
              banner + the ModulesPending panel below carry the single "go analyse" next step — no row
              of disabled buttons. */}
          {!heroDisabled ? (
            <>
              <form action={generateOpportunitiesAction}>
                <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
                <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
                <SubmitButton className="button" pendingLabel="werden erzeugt …">
                  Alle Optimierungschancen erzeugen
                </SubmitButton>
              </form>
              <div className="locked-action">
                <form action={syncSearchPerformanceAction}>
                  <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
                  <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
                  <SubmitButton className="button secondary" pendingLabel="wird synchronisiert …" disabled={!data.hasIntegration}>
                    Search Performance synchronisieren
                  </SubmitButton>
                </form>
                {/* Search-Performance sync pulls clicks/impressions from GSC — without a connected source it
                    would do nothing, so gate it honestly instead of offering a silent no-op. */}
                {!data.hasIntegration ? (
                  <span className="locked-action__reason">
                    <Icon name="lock" />
                    Zuerst Google Search Console verbinden — dann liefert die Synchronisierung echte Klick- und Ranking-Daten.
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {opportunities.length === 0 ? (
        <ModulesPending
          icon="lightbulb"
          title="Noch keine Optimierungschancen"
          text="Priorisierte Chancen mit Wirkung-/Aufwand-Matrix und Maßnahmen entstehen aus Ihrer Analyse. Starten Sie zuerst eine Analyse Ihrer Website."
          ctaHref="/technical-audit#crawl-start"
          ctaLabel="Analyse starten →"
          ctaVariant="secondary"
        />
      ) : (
        <>
          <HelpDisclosure summary="So lesen Sie die Optimierungschancen">
            <WhyItMatters>
              Die Wirkung-/Aufwand-Matrix zeigt die günstigsten Hebel zuerst — schnelle Erfolge vor großen Projekten.
            </WhyItMatters>
          </HelpDisclosure>

          {/* Schicht 1: rule-based Kernbefund + the four numbers that frame the opportunity backlog. */}
          <SummaryHead
            verdict={deriveOpportunitiesVerdict({ total: data.meta.total, active: openCount, quickWins, topPriority: topPriority?.priority ?? null }) ?? undefined}
            metrics={[
              { label: "Opportunities", value: String(data.meta.total), note: `${opportunities.length} geladen` },
              { label: "Aktiv (offen)", value: String(openCount), note: "nicht validiert/dismissed/expired" },
              { label: "Quick Wins", value: String(quickWins), note: "hohe Wirkung, niedriger Aufwand" },
              { label: "Validiert", value: String(validatedCount), note: topPriority ? `Top-Prio ${topPriority.priority}` : "Vorher/Nachher bestätigt" },
            ]}
          />

          <OpportunityBoardClient
            opportunities={opportunities}
            onBulkTransition={bulkTransitionOpportunitiesAction}
            revalidateAction={revalidateOpportunityAction}
            transitionAction={transitionOpportunityAction}
          />

          <NextStep
            hint="Chancen priorisiert — setzen Sie sie im Content Workspace in konkrete Briefs um."
            href="/content-workspace"
            ctaLabel="Zum Content Workspace →"
          />
        </>
      )}
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
