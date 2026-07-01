import "../../features/keyword-rank/keywords.css";

import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { PageSkeleton } from "../../components/page-skeleton";
import { OfflineNotice } from "../../components/offline-notice";
import { ConnectionBadge } from "../../components/connection-badge";
import { MetricCard } from "../../components/metric-card";
import { WhyItMatters } from "../../components/why-it-matters";
import { TermTooltip } from "../../components/term-tooltip";
import { GlossarLink } from "../../components/glossar-link";
import { HelpDisclosure } from "../../components/help-disclosure";
import { Icon } from "../../components/icon";
import { PREREQUISITE_META } from "../../lib/readiness";
import { PositionDistribution } from "../../components/charts/position-distribution";
import { TrendChart } from "../../components/charts/trend-chart";
import { KeywordTableClient } from "../../features/keyword-rank";
import { NextStep } from "../../components/next-step";
import { SubmitButton } from "../../components/submit-button";
import { loadKeywordsRankData } from "../../lib/keywords-api";
import { addKeywordsAction, computeVisibilityAction, createKeywordGroupAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AppShell activePath="/keywords-rank">
      <Suspense fallback={<PageSkeleton label="Keywords & Rankings werden geladen …" />}>
        <KeywordsRankBody params={params} />
      </Suspense>
    </AppShell>
  );
}

// Data-dependent body — streamed behind Suspense so the shell paints immediately.
async function KeywordsRankBody({
  params,
}: {
  params: Record<string, string | string[] | undefined> | undefined;
}) {
  const data = await loadKeywordsRankData();
  const feedback = feedbackMessage(params);

  const brandCount = data.rows.filter((r) => r.brand).length;
  // Two-mode: until the project actually has keywords, the KPI grid / charts / table are all empty
  // shells. Hide them and lead with the "Keywords hinzufügen" form — the single real next step.
  const hasKeywords = data.totalKeywords > 0;
  // A Visibility-Index computed over zero ranked keywords is a meaningless 0 — treat it as "no data".
  const hasVisibility = data.latestVisibility != null && data.latestVisibility.trackedKeywords > 0;
  const visScore = hasVisibility ? data.latestVisibility!.score : undefined;
  const visDelta =
    data.latestVisibility && data.previousVisibility
      ? data.latestVisibility.score - data.previousVisibility.score
      : null;

  const curationForms = (
    <div className="cards-2">
      <div className="card">
        <p className="kicker">Keywords hinzufügen</p>
        <WhyItMatters showIcon={false}>
          Neue Begriffe werden automatisch nach{" "}
          <TermTooltip term="Keyword / Intent">Intent</TermTooltip>, Brand und{" "}
          <TermTooltip term="Funnel-Stage">Funnel-Stage</TermTooltip> klassifiziert.
        </WhyItMatters>
        <form className="form-card" action={addKeywordsAction}>
          <input type="hidden" name="projectId" value={data.project?.id ?? ""} />
          <label>
            Keywords (eines pro Zeile)
            <textarea
              name="phrases"
              rows={5}
              placeholder={"seo tool kaufen\nahrefs vs semrush\nwie funktioniert seo"}
              required
            />
          </label>
          <label>
            Cluster (optional)
            <select name="groupId" defaultValue="">
              <option value="">— kein Cluster —</option>
              {data.groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          <label>
            Brand-Begriffe (kommagetrennt, optional)
            <input name="brandTerms" placeholder="query-land, acme" />
          </label>
          <div className="locked-action">
            <SubmitButton className="button" pendingLabel="wird gespeichert …" disabled={!data.connected || !data.project}>
              Klassifizieren &amp; speichern
            </SubmitButton>
            {!data.connected || !data.project ? (
              <span className="locked-action__reason">
                <Icon name="lock" />
                {!data.connected ? "Daten momentan nicht erreichbar." : PREREQUISITE_META.project.reason}
              </span>
            ) : null}
          </div>
        </form>
      </div>
      <div className="card">
        <p className="kicker">Cluster anlegen</p>
        <WhyItMatters showIcon={false}>
          Cluster bündeln thematisch verwandte Keywords für Reporting und Analyse.
        </WhyItMatters>
        <form className="form-card" action={createKeywordGroupAction}>
          <input type="hidden" name="projectId" value={data.project?.id ?? ""} />
          <label>Name<input name="name" placeholder="Pricing" required /></label>
          <label>Thema (optional)<input name="topic" placeholder="Money pages" /></label>
          <div className="locked-action">
            <SubmitButton className="button secondary" pendingLabel="wird angelegt …" disabled={!data.connected || !data.project}>
              Cluster anlegen
            </SubmitButton>
            {!data.connected || !data.project ? (
              <span className="locked-action__reason">
                <Icon name="lock" />
                {!data.connected ? "Daten momentan nicht erreichbar." : PREREQUISITE_META.project.reason}
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <header className="page-header">
        <div className="page-header__titles">
          <p className="kicker">Suchbegriffe &amp; Platzierungen</p>
          <h1>Keywords &amp; Rankings</h1>
          <p className="page-header__purpose">
            Für welche Suchbegriffe Ihre Website bei Google erscheint — und auf welcher Position. Jede
            Zeile zeigt den Positions-Trend und die Veränderung seit der letzten Messung.
          </p>
        </div>
        <div className="page-header__aside">
          <span className="badge">{data.groups.length} Cluster</span>
          <ConnectionBadge connected={data.connected} />
          {hasKeywords ? (
            <div className="locked-action">
              <form action={computeVisibilityAction}>
                <input type="hidden" name="projectId" value={data.project?.id ?? ""} />
                <SubmitButton className="button secondary" pendingLabel="wird berechnet …" disabled={!data.connected || !data.project}>
                  Visibility neu berechnen
                </SubmitButton>
              </form>
              {!data.connected || !data.project ? (
                <span className="locked-action__reason">
                  <Icon name="lock" />
                  {!data.connected ? "Daten momentan nicht erreichbar." : PREREQUISITE_META.project.reason}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
      {!data.connected ? <OfflineNotice /> : null}

      <HelpDisclosure summary="So lesen Sie Keywords & Rankings">
        <p>
          <TermTooltip term="Striking Distance">Striking-Distance</TermTooltip>-Keywords (Position 11–20)
          sind die günstigsten Hebel — ein paar Plätze entscheiden über Sichtbarkeit. Der{" "}
          <GlossarLink term="Visibility-Index">Visibility-Index</GlossarLink> bündelt die
          positionsgewichtete Sichtbarkeit über das eigene Keyword-Set zu einer Zahl.
        </p>
      </HelpDisclosure>

      {hasKeywords ? (
        <>
          {/* At-a-glance verdict: the numbers that frame visibility & reach */}
          <div className="verdict-strip verdict-strip--4">
            <MetricCard
              label="Visibility-Index"
              value={visScore != null ? String(visScore) : "—"}
              info={
                <>
                  Positionsgewichtete Sichtbarkeit (0–100) auf dem eigenen Keyword-Set. Mehr im{" "}
                  <GlossarLink term="Visibility-Index">Glossar</GlossarLink>.
                </>
              }
              note={
                hasVisibility
                  ? `${data.latestVisibility!.trackedKeywords} getrackt · Ø Pos ${data.latestVisibility!.averagePosition ?? "—"}${
                      visDelta != null ? ` · ${visDelta > 0 ? "+" : ""}${visDelta} Pkt` : ""
                    } · Konfidenz C (SERP-Stichprobe)`
                  : "erscheint nach der ersten Ranking-Messung"
              }
            />
            <MetricCard
              label="Keywords"
              value={String(data.totalKeywords)}
              info="Alle im Projekt kuratierten Begriffe — die Grundlage für Rankings und Sichtbarkeit."
              note={`${data.rows.length} geladen`}
            />
            <MetricCard
              label="Cluster"
              value={String(data.groups.length)}
              info="Thematisch gebündelte Keyword-Gruppen für Reporting und Analyse."
              note="Themen-/Keyword-Gruppen"
            />
            <MetricCard
              label="Brand"
              value={String(brandCount)}
              info="Keywords mit der eigenen Marke (Brand). Sie ranken meist leicht und sagen wenig über Wachstumspotenzial."
              note="von den geladenen Keywords"
            />
          </div>

          {/* Charts: PositionDistribution + Visibility TrendChart */}
          <section className="kw-charts">
            <div className="card kw-chart-card">
              <p className="kicker">Positions-Verteilung</p>
              <WhyItMatters showIcon={false}>
                Verteilung der getrackten Keywords über die fünf Ranking-Tiers.
              </WhyItMatters>
              <PositionDistribution buckets={data.buckets} />
            </div>
            <div className="card kw-chart-card">
              <p className="kicker">
                <TermTooltip term="Visibility-Index">Visibility-Index</TermTooltip> · Verlauf
              </p>
              <WhyItMatters showIcon={false}>
                Positionsgewichtete Sichtbarkeit über die Zeit (0–100).
              </WhyItMatters>
              <TrendChart data={data.visibilityTrend} valueLabel="Visibility" />
            </div>
          </section>

          {/* Interactive keyword table + FilterBar + Inspector — single focus */}
          <KeywordTableClient rows={data.rows} inspectors={data.inspectors} />

          {/* Curation forms — collapsed once keywords exist */}
          <details className="advanced-section">
            <summary>
              <span className="advanced-section__title">Keywords &amp; Cluster verwalten</span>
              <span className="advanced-section__hint">
                Neue Begriffe hinzufügen und thematische Cluster anlegen.
              </span>
            </summary>
            {curationForms}
          </details>

          <NextStep
            hint="Ihre Keywords stehen — die stärksten Hebel werden zu priorisierten Optimierungschancen."
            href="/content-opportunities"
            ctaLabel="Zu den Chancen →"
          />
        </>
      ) : (
        // Empty state: the curation forms ARE the primary next step, so they lead directly.
        curationForms
      )}
    </>
  );
}

function feedbackMessage(
  params: Record<string, string | string[] | undefined> | undefined
): { kind: "success" | "danger" | "warning"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.added)) return { kind: "success", message: "Keywords klassifiziert und gespeichert." };
  if (singleParam(params?.group)) return { kind: "success", message: "Keyword-Cluster angelegt." };
  const visibility = singleParam(params?.visibility);
  if (visibility === "empty") {
    return { kind: "warning", message: "Noch keine Ranking-Daten — der Visibility-Index erscheint nach der ersten Positions-Messung." };
  }
  if (visibility) return { kind: "success", message: "Visibility-Index neu berechnet." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
