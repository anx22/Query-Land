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
import { UrlExplorerTable } from "../../features/technical-audit/url-explorer-table";
import { CrawlStartPanel } from "../../features/technical-audit/crawl-start";
import { actionLock } from "../../lib/readiness";
import {
  computePageInfo,
  paginationHref,
  URL_EXPLORER_PAGE_SIZE,
} from "../../features/technical-audit/url-explorer";
import { isDefaultIssueFilter, loadTechnicalAuditOverview, RUN_PAGE_SIZE } from "../../lib/audit-api";
import { resolveActionBanner } from "../../features/technical-audit/action-banner";
import {
  isDefaultUrlExplorerFilter,
  URL_SOURCE_FILTERS,
  URL_STATUS_FILTERS,
  urlFilterHref,
  urlSourceFilterLabel,
  urlStatusFilterLabel,
} from "../../features/technical-audit/url-explorer";
import {
  diffRuleLabel,
  formatDelta,
  hasCompleteSelection,
  runOptionLabel,
  severityBadgeTone,
  severityLabel,
  type FormattedDelta,
} from "../../features/technical-audit/crawl-diff";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const RUN_STATUS_LABEL: Record<string, string> = {
  running: "läuft",
  succeeded: "erfolgreich",
  failed: "fehlgeschlagen",
};

/** Server-rendered Zurück/Weiter pagination links (no client fetching). */
function Pagination({
  page,
  currentParams,
  param,
}: {
  page: ReturnType<typeof computePageInfo>;
  currentParams: Record<string, string | undefined>;
  param: string;
}) {
  if (page.pageCount <= 1) return null;
  return (
    <nav className="audit-pagination" aria-label="Seitennavigation">
      {page.hasPrev ? (
        <a className="button compact" href={paginationHref(currentParams, param, page.prevOffset)} rel="prev">
          ← Zurück
        </a>
      ) : (
        <span className="button compact" aria-disabled="true">
          ← Zurück
        </span>
      )}
      <span className="audit-pagination__status">
        Seite {page.page} von {page.pageCount}
      </span>
      {page.hasNext ? (
        <a className="button compact" href={paginationHref(currentParams, param, page.nextOffset)} rel="next">
          Weiter →
        </a>
      ) : (
        <span className="button compact" aria-disabled="true">
          Weiter →
        </span>
      )}
    </nav>
  );
}

/** A single Δ card (sign + functional tone + label). */
function DeltaCard({ label, delta, unit }: { label: string; delta: FormattedDelta; unit?: string }) {
  return (
    <div className="audit-delta-card">
      <span className="audit-delta-card__label">{label}</span>
      <span className={`audit-delta-card__value audit-delta-card__value--${delta.tone}`}>
        {delta.text}
        {unit && delta.text !== "—" ? unit : ""}
      </span>
    </div>
  );
}

/** List of appeared/fixed diff issues (url + rule + severity + message). */
function DiffIssueList({
  title,
  issues,
}: {
  title: string;
  issues: { id: string; url: string; rule: Parameters<typeof diffRuleLabel>[0]; severity: Parameters<typeof severityLabel>[0]; message: string }[];
}) {
  return (
    <div className="audit-diff-list">
      <div className="audit-diff-list__head">
        <span className="audit-diff-list__title">{title}</span>
        <span className="audit-diff-list__count">{issues.length.toLocaleString("de-DE")}</span>
      </div>
      {issues.length > 0 ? (
        <ul className="audit-diff-issues">
          {issues.map((issue) => (
            <li className="audit-diff-issue" key={issue.id}>
              <div className="audit-diff-issue__head">
                <span className={`badge ${severityBadgeTone(issue.severity)}`.trim()}>
                  {severityLabel(issue.severity)}
                </span>
                <span className="audit-diff-issue__rule">{diffRuleLabel(issue.rule)}</span>
              </div>
              <span className="audit-diff-issue__url">{issue.url}</span>
              <span className="audit-diff-issue__message">{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="audit-diff-list__empty">Keine.</p>
      )}
    </div>
  );
}

/** Crawl-Vergleich section: two run selectors (GET form) + the rendered diff. */
function CrawlDiffSection({
  data,
  currentParams,
}: {
  data: Awaited<ReturnType<typeof loadTechnicalAuditOverview>>;
  currentParams: Record<string, string | undefined>;
}) {
  const runs = data.diffSelectableRuns;
  const { diffSelection, crawlDiff } = data;

  // Params to preserve across the GET form submit (everything except the two
  // diff selectors, which the form's own fields carry).
  const preserved = Object.entries(currentParams).filter(
    ([key, value]) => key !== "diffBase" && key !== "diffCompare" && value != null && value !== ""
  );

  return (
    <section className="card">
      <p className="kicker">
        <TermTooltip term="crawl">Crawl</TermTooltip>-Vergleich
      </p>
      <p className="muted">
        Zwei Crawl-Läufe gegenüberstellen: was kam hinzu, was wurde behoben und wie haben sich
        Health-Score, offene Issues und entdeckte URLs verändert.
        <ConfidenceBadge level="A" />
      </p>

      {runs.length < 2 ? (
        <p className="audit-diff-empty">
          Für einen Vergleich werden mindestens zwei Crawl-Läufe benötigt. Starte weitere Crawls, um
          Veränderungen über die Zeit zu sehen.
        </p>
      ) : (
        <>
          <form method="get" action="/technical-audit" className="audit-diff-selectors">
            {preserved.map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value as string} />
            ))}
            <label className="audit-diff-selector">
              <span className="audit-diff-selector__label">Basis (älter)</span>
              <select
                className="audit-diff-select"
                name="diffBase"
                defaultValue={diffSelection.base ?? ""}
                aria-label="Basis-Lauf wählen"
              >
                <option value="">— wählen —</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runOptionLabel(run)}
                  </option>
                ))}
              </select>
            </label>
            <label className="audit-diff-selector">
              <span className="audit-diff-selector__label">Vergleich (neuer)</span>
              <select
                className="audit-diff-select"
                name="diffCompare"
                defaultValue={diffSelection.compare ?? ""}
                aria-label="Vergleichs-Lauf wählen"
              >
                <option value="">— wählen —</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runOptionLabel(run)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button compact">
              Vergleichen
            </button>
          </form>

          {!hasCompleteSelection(diffSelection) ? (
            <p className="audit-diff-empty">
              Wähle einen Basis- und einen Vergleichs-Lauf und klicke auf „Vergleichen“.
            </p>
          ) : crawlDiff === null ? (
            <p className="audit-diff-empty">
              Der Vergleich konnte nicht geladen werden. Bitte erneut versuchen.
            </p>
          ) : (
            <>
              <div className="audit-diff-deltas">
                <DeltaCard
                  label="Δ Health-Score"
                  delta={formatDelta(crawlDiff.deltas.healthScore, "higherIsBetter")}
                />
                <DeltaCard
                  label="Δ offene Issues"
                  delta={formatDelta(crawlDiff.deltas.openIssues, "higherIsWorse")}
                />
                <DeltaCard
                  label="Δ entdeckte URLs"
                  delta={formatDelta(crawlDiff.deltas.discoveredUrls, "none")}
                />
              </div>

              <div className="audit-diff-lists">
                <DiffIssueList title="Neu seit Basis" issues={crawlDiff.appearedIssues} />
                <DiffIssueList title="Behoben" issues={crawlDiff.fixedIssues} />
                <div className="audit-diff-list">
                  <div className="audit-diff-list__head">
                    <span className="audit-diff-list__title">Neu entdeckte URLs</span>
                    <span className="audit-diff-list__count">
                      {crawlDiff.newUrls.length.toLocaleString("de-DE")}
                    </span>
                  </div>
                  {crawlDiff.newUrls.length > 0 ? (
                    <ul className="audit-diff-urls">
                      {crawlDiff.newUrls.map((url) => (
                        <li className="audit-diff-url" key={url.id}>
                          {url.normalizedUrl || url.url}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="audit-diff-list__empty">Keine.</p>
                  )}
                </div>
              </div>

              <p className="audit-diff-persisting">
                {crawlDiff.persistingCount.toLocaleString("de-DE")} Issue(s) bestehen in beiden Läufen
                fort.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const data = await loadTechnicalAuditOverview({
    issueStatus: firstParam(params.status),
    issueSeverity: firstParam(params.severity),
    issueRule: firstParam(params.issueRule),
    urlStatus: firstParam(params.urlStatus),
    urlSource: firstParam(params.urlSource),
    urlQ: firstParam(params.urlQ),
    urlOffset: firstParam(params.urlOffset),
    runOffset: firstParam(params.runOffset),
    diffBase: firstParam(params.diffBase),
    diffCompare: firstParam(params.diffCompare),
  });

  const actionBanner = resolveActionBanner({
    error: firstParam(params.error),
    started: firstParam(params.started),
  });

  // Flatten the current searchParams to a single-value map for href building,
  // so pagination links preserve filters and the other offset param.
  const currentParams: Record<string, string | undefined> = {
    status: firstParam(params.status),
    severity: firstParam(params.severity),
    issueRule: firstParam(params.issueRule),
    urlStatus: firstParam(params.urlStatus),
    urlSource: firstParam(params.urlSource),
    urlQ: firstParam(params.urlQ),
    urlOffset: firstParam(params.urlOffset),
    runOffset: firstParam(params.runOffset),
    diffBase: firstParam(params.diffBase),
    diffCompare: firstParam(params.diffCompare),
  };

  const urlPage = computePageInfo(data.urlExplorerMeta.offset, URL_EXPLORER_PAGE_SIZE, data.urlExplorerMeta.total);
  const runPage = computePageInfo(data.runOffset, RUN_PAGE_SIZE, data.runTotal);

  const healthValue = data.latestHealthScore?.score ?? null;
  const healthDelta =
    data.latestHealthScore && data.previousHealthScore
      ? data.latestHealthScore.score - data.previousHealthScore.score
      : null;

  // A run only blocks the start button while it is *actively* running. A run
  // stuck in "running" (worker died / drain timed out) must not lock the button
  // forever — treat anything older than STALE_RUN_MS as no longer in flight.
  const STALE_RUN_MS = 15 * 60 * 1000;
  const now = Date.now();
  const runningRun =
    data.recentCrawlRuns.find(
      (run) => run.status === "running" && now - new Date(run.startedAt).getTime() < STALE_RUN_MS
    ) ?? null;
  const crawlLock = actionLock(data.readiness, ["project", "site"]);
  const feedback = feedbackMessage(params);

  return (
    <AppShell activePath="/technical-audit">
      {actionBanner ? (
        <p className={`notice ${actionBanner.tone}`} role={actionBanner.role}>
          {actionBanner.message}
        </p>
      ) : null}

      {data.loadErrors.length > 0 ? (
        <p className="notice danger" role="alert">
          Einige Bereiche konnten nicht geladen werden ({data.loadErrors.join(", ")}). Die Anzeige ist
          deshalb unvollständig — das ist ein Ladefehler, kein „leerer" Zustand. Bitte neu laden.
        </p>
      ) : null}

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
          <span className={data.connected ? "badge success" : "badge danger"}>
            {data.connected ? "API verbunden" : "API offline"}
          </span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? (
          <p className="notice danger">
            {data.errorMessage ?? "Audit-Daten konnten nicht geladen werden."} · Erwartete API:{" "}
            {data.apiBaseUrl}
          </p>
        ) : null}
      </section>

      {/* Primary action: start a crawl (the entry point of the whole loop) */}
      <CrawlStartPanel
        project={data.project}
        site={data.site}
        lock={crawlLock}
        connected={data.connected}
        runningRun={runningRun}
      />

      {/* Help zone — layout-separated from the productive panels below */}
      <HelpPanel title="So lesen Sie das Technical Audit">
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
            Wo verliert die Seite URLs auf dem Weg zu Google? Entdeckt → Gecrawlt → Indexierbar
            (aus dem letzten Crawl-Lauf).
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
        <p className="kicker">Gesundheit nach Website-Bereich</p>
        <p className="muted">
          Jede Kachel ist ein Bereich der Website (z. B. /blog). Größe = Anzahl URLs,
          Farbe = technische Gesundheit (rot = viele Probleme).
        </p>
        <SectionTreemap sections={data.sections} />
        {data.sections.length > 0 ? (
          <div className="audit-treemap-legend" aria-hidden="true">
            <span className="audit-treemap-legend__item">
              <span className="audit-treemap-legend__swatch audit-treemap-legend__swatch--success" /> gesund (≥70)
            </span>
            <span className="audit-treemap-legend__item">
              <span className="audit-treemap-legend__swatch audit-treemap-legend__swatch--warning" /> auffällig (40–69)
            </span>
            <span className="audit-treemap-legend__item">
              <span className="audit-treemap-legend__swatch audit-treemap-legend__swatch--danger" /> kritisch (&lt;40)
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
          , gruppiert nach Regel und Schweregrad und nach Wirkung (Anzahl × Schweregrad)
          sortiert — das Wichtigste zuerst.
        </p>
        <IssueFilterBar active={data.activeIssueFilter} />
        <IssueGroups groups={data.issueGroups} />
      </section>

      {/* URL-Explorer */}
      <section className="card">
        <p className="kicker">URL-Explorer</p>
        <p className="muted">
          Entdeckte URLs mit HTTP-Status und Indexierbarkeit aus dem letzten Crawl. Auf eine Zeile
          klicken, um Abruf-, Indexierbarkeits- und Crawl-Kontext zu sehen.
          {data.urlExplorerMeta.total > 0
            ? ` ${data.urlExplorerMeta.total.toLocaleString("de-DE")} URLs insgesamt.`
            : ""}
        </p>
        <div className="issue-filter-bar">
          <div className="badge-row" role="group" aria-label="URLs nach Fetch-Status filtern">
            <span className="muted issue-filter-bar__label">Status</span>
            {URL_STATUS_FILTERS.map((status) => {
              const selected = status === data.activeUrlFilter.status;
              return (
                <a
                  key={status}
                  href={urlFilterHref(currentParams, { ...data.activeUrlFilter, status })}
                  className={selected ? "badge primary" : "badge"}
                  aria-current={selected ? "true" : undefined}
                >
                  {urlStatusFilterLabel(status)}
                </a>
              );
            })}
          </div>
          <div className="badge-row" role="group" aria-label="URLs nach Quelle filtern">
            <span className="muted issue-filter-bar__label">Quelle</span>
            {URL_SOURCE_FILTERS.map((source) => {
              const selected = source === data.activeUrlFilter.source;
              return (
                <a
                  key={source}
                  href={urlFilterHref(currentParams, { ...data.activeUrlFilter, source })}
                  className={selected ? "badge primary" : "badge"}
                  aria-current={selected ? "true" : undefined}
                >
                  {urlSourceFilterLabel(source)}
                </a>
              );
            })}
          </div>
          <form method="GET" action="/technical-audit" className="badge-row" role="search" aria-label="URLs nach Adresse durchsuchen">
            <span className="muted issue-filter-bar__label">Suche</span>
            {/* Preserve other filters/params; omit urlQ (this field) and urlOffset (reset on search). */}
            {Object.entries(currentParams)
              .filter(([key, value]) => value != null && value !== "" && key !== "urlQ" && key !== "urlOffset")
              .map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
            <input
              type="search"
              name="urlQ"
              defaultValue={data.activeUrlFilter.q}
              placeholder="URL enthält…"
              className="input compact"
              aria-label="URL-Substring"
            />
            <button type="submit" className="button compact">Suchen</button>
          </form>
        </div>
        {data.urlExplorerRows.length === 0 && !isDefaultUrlExplorerFilter(data.activeUrlFilter) ? (
          <p className="muted">Keine URLs für den aktiven Filter{data.activeUrlFilter.q ? ` / die Suche „${data.activeUrlFilter.q}"` : ""}.</p>
        ) : null}
        <UrlExplorerTable rows={data.urlExplorerRows} />
        <Pagination page={urlPage} currentParams={currentParams} param="urlOffset" />
      </section>

      {/* Crawl-Vergleich (crawl-diff) */}
      <CrawlDiffSection data={data} currentParams={currentParams} />

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
        <Pagination page={runPage} currentParams={currentParams} param="runOffset" />
      </section>
    </AppShell>
  );
}

function feedbackMessage(
  params: Record<string, string | string[] | undefined>
): { kind: "success" | "danger"; message: string } | null {
  const error = firstParam(params.error);
  if (error) return { kind: "danger", message: error };
  if (firstParam(params.started)) {
    return { kind: "success", message: "Crawl gestartet — die Ergebnisse erscheinen unten." };
  }
  if (firstParam(params.health)) {
    return { kind: "success", message: "Health Score neu berechnet." };
  }
  if (firstParam(params.issue)) {
    return { kind: "success", message: "Issue-Status aktualisiert." };
  }
  return null;
}
