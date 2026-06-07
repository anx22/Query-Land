import "../../features/keyword-rank/keywords.css";

import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { WhyItMatters } from "../../components/why-it-matters";
import { TermTooltip } from "../../components/term-tooltip";
import { PositionDistribution } from "../../components/charts/position-distribution";
import { TrendChart } from "../../components/charts/trend-chart";
import { KeywordTableClient } from "../../features/keyword-rank";
import { loadKeywordsRankData } from "../../lib/keywords-api";
import { addKeywordsAction, computeVisibilityAction, createKeywordGroupAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await loadKeywordsRankData();
  const feedback = feedbackMessage(params);

  const brandCount = data.rows.filter((r) => r.brand).length;
  const visScore = data.latestVisibility?.score;
  const visDelta =
    data.latestVisibility && data.previousVisibility
      ? data.latestVisibility.score - data.previousVisibility.score
      : null;

  return (
    <AppShell activePath="/keywords-rank">
      <section className="card hero-card">
        <p className="kicker">Keywords &amp; Rank</p>
        <h1>Keywords &amp; Rankings</h1>
        <p>
          Das eigene Keyword-Universum mit Positionen und Sichtbarkeit. Jede Zeile zeigt den
          Positions-Trend, die Veränderung gegenüber dem letzten Snapshot und die Quell-Konfidenz.
        </p>
        <WhyItMatters>
          <TermTooltip term="Striking Distance">Striking-Distance</TermTooltip>-Keywords (Position 11–20)
          sind die günstigsten Hebel — ein paar Plätze entscheiden über Sichtbarkeit.
        </WhyItMatters>
        <div className="badge-row">
          <span className="badge primary">{data.project?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.groups.length} Cluster</span>
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
          <form action={computeVisibilityAction}>
            <input type="hidden" name="projectId" value={data.project?.id ?? ""} />
            <button className="button secondary" type="submit" disabled={!data.connected || !data.project}>
              Visibility neu berechnen
            </button>
          </form>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          label="Visibility-Index"
          value={visScore != null ? String(visScore) : "—"}
          note={
            data.latestVisibility
              ? `${data.latestVisibility.trackedKeywords} getrackt · Ø Pos ${data.latestVisibility.averagePosition ?? "—"}${
                  visDelta != null ? ` · ${visDelta > 0 ? "+" : ""}${visDelta} Pkt` : ""
                }`
              : "noch nicht berechnet"
          }
        />
        <MetricCard label="Keywords" value={String(data.totalKeywords)} note={`${data.rows.length} geladen`} />
        <MetricCard label="Cluster" value={String(data.groups.length)} note="Themen-/Keyword-Gruppen" />
        <MetricCard label="Brand" value={String(brandCount)} note="von den geladenen Keywords" />
      </section>

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

      {/* Interactive keyword table + FilterBar + Inspector */}
      <KeywordTableClient rows={data.rows} inspectors={data.inspectors} />

      {/* Curation forms (reframed in voice) */}
      <section className="content-grid">
        <div className="card">
          <p className="kicker">Keywords hinzufügen</p>
          <WhyItMatters showIcon={false}>
            Neue Begriffe werden automatisch nach Intent, Brand und Funnel-Stage klassifiziert.
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
            <button className="button" type="submit" disabled={!data.connected || !data.project}>
              Klassifizieren &amp; speichern
            </button>
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
            <button className="button secondary" type="submit" disabled={!data.connected || !data.project}>
              Cluster anlegen
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}

function feedbackMessage(
  params: Record<string, string | string[] | undefined> | undefined
): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.added)) return { kind: "success", message: "Keywords klassifiziert und gespeichert." };
  if (singleParam(params?.group)) return { kind: "success", message: "Keyword-Cluster angelegt." };
  if (singleParam(params?.ranked)) return { kind: "success", message: "Rang-Snapshot erfasst (SERP-Provider-Stub)." };
  if (singleParam(params?.visibility)) return { kind: "success", message: "Visibility-Index neu berechnet." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
