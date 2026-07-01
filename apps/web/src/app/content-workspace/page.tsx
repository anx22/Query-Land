import "../../features/content-workspace/workspace.css";

import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { PageSkeleton } from "../../components/page-skeleton";
import { OfflineNotice } from "../../components/offline-notice";
import { ConnectionBadge } from "../../components/connection-badge";
import { ScoreGauge } from "../../components/charts/score-gauge";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { WhyItMatters } from "../../components/why-it-matters";
import { HelpDisclosure } from "../../components/help-disclosure";
import { ModulesPending } from "../../components/modules-pending";
import { NextStep } from "../../components/next-step";
import { SubmitButton } from "../../components/submit-button";
import { BriefEditor } from "../../features/content-workspace/brief-editor";
import {
  availableTransitions,
  BRIEF_STATUS_FILTERS,
  briefStatusLabel,
  resolveWorkspaceBanner,
  scoreBandLabel,
  type BriefStatusFilter,
} from "../../features/content-workspace/brief-form";
import {
  addInternalLinkAction,
  createBriefAction,
  createProposalAction,
  transitionBriefAction,
  updateBriefAction,
} from "../../features/content-workspace/actions";
import { loadContentWorkspace } from "../../lib/content-api";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_BADGE_TONE: Record<string, string> = {
  draft: "",
  ready: "primary",
  in_progress: "primary",
  done: "success",
  dismissed: "danger",
};

const TRANSITION_LABELS: Record<string, string> = {
  ready: "Als bereit markieren",
  in_progress: "In Arbeit nehmen",
  done: "Als erledigt markieren",
  dismissed: "Verwerfen",
  draft: "Wieder öffnen",
};

/** Build a workspace href preserving the selected URL + status filter. */
function workspaceHref(params: {
  url?: string | null;
  status?: BriefStatusFilter;
  briefId?: string | null;
}): string {
  const search = new URLSearchParams();
  if (params.url) search.set("url", params.url);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.briefId) search.set("briefId", params.briefId);
  const qs = search.toString();
  return qs ? `/content-workspace?${qs}` : "/content-workspace";
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  return (
    <AppShell activePath="/content-workspace">
      <Suspense fallback={<PageSkeleton label="Content Workspace wird geladen …" />}>
        <ContentWorkspaceBody params={params} />
      </Suspense>
    </AppShell>
  );
}

// Data-dependent body — streamed behind Suspense so the shell paints immediately.
async function ContentWorkspaceBody({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const data = await loadContentWorkspace({
    url: firstParam(params.url),
    status: firstParam(params.status),
    briefId: firstParam(params.briefId),
  });

  const banner = resolveWorkspaceBanner({
    error: firstParam(params.error),
    saved: firstParam(params.saved),
  });

  const projectId = data.project?.id ?? "";
  const siteId = data.site?.id ?? "";
  const selectedBrief = data.selectedBrief;
  const score = data.contentScore;
  const opportunityId = firstParam(params.opportunityId) ?? "";

  // Two-mode + master-detail. Until an analysis (or GSC) has produced refresh candidates — and no
  // brief has been created manually — the score/link/candidate machinery is a wall of empty
  // placeholder panels. Hide it behind one calm ModulesPending panel; the "Neuen Brief erstellen"
  // form below stays, since manual briefs work without any data.
  const hasWorkspaceData = data.refreshCandidates.length > 0 || data.briefs.length > 0;
  // The score + internal-link panels are the DETAIL of the candidate list: only meaningful once a
  // candidate (URL) is selected. Progressive disclosure — no empty "Wähle einen Kandidaten" panels.
  const hasSelection = Boolean(data.selectedUrl);

  return (
    <>
      {banner ? (
        <p className={`notice ${banner.tone}`} role={banner.role}>
          {banner.message}
        </p>
      ) : null}

      <section className="card hero-card">
        <p className="kicker">Content Workspace</p>
        <h1>Refresh-Kandidaten, Content-Score &amp; manuelle Briefs</h1>
        <p>
          Welche Seiten verlieren Sichtbarkeit, wie gut ist eine URL inhaltlich aufgestellt und welche
          konkrete Refresh-Arbeit lohnt sich? Briefs sind manuell editierbare Artefakte (keine
          KI-Generierung) und lassen sich als Ticket oder PR in die Umsetzung übergeben.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.project?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.site?.baseUrl ?? "keine Website"}</span>
          <ConnectionBadge connected={data.connected} />
        </div>
        {!data.connected ? <OfflineNotice /> : null}
        {data.connected && (!data.project || !data.site) ? (
          <p className="notice">
            Fügen Sie zuerst eine Website hinzu, um Refresh-Kandidaten und Briefs zu sehen.
          </p>
        ) : null}
      </section>

      <HelpDisclosure summary="So nutzt du den Content Workspace">
        <p>
          Wähle links einen Refresh-Kandidaten — das treibt den Content-Score-Gauge und die internen
          Link-Vorschläge rechts. Erstelle daraus einen Brief, pflege Gliederung und Term-Checkliste
          manuell und schiebe ihn über den Status-Verlauf bis „erledigt“. Klick-Werte (Klick-Trend,
          Score) erscheinen, sobald die Google Search Console verbunden ist — bis dahin bleibt diese
          Liste leer.
        </p>
      </HelpDisclosure>

      {/* First-run: no candidates and no briefs → one calm panel instead of empty machinery. The
          create-brief form below stays available for manual briefs. */}
      {data.connected && data.project && data.site && !hasWorkspaceData ? (
        <ModulesPending
          icon="description"
          title="Noch keine Content-Daten"
          text="Refresh-Kandidaten, Content-Score und interne Link-Vorschläge erscheinen hier nach Ihrer ersten Analyse — bzw. sobald die Google Search Console verbunden ist. Einen Brief können Sie jederzeit manuell unten anlegen."
          ctaHref="/technical-audit#crawl-start"
          ctaLabel="Zur Analyse →"
          ctaVariant="secondary"
        />
      ) : null}

      {hasWorkspaceData && data.refreshCandidates.length > 0 ? (
      <div className="cw-grid">
        {/* Refresh candidates */}
        <section className="card">
          <p className="kicker">Refresh-Kandidaten</p>
          <p className="muted">
            Seiten mit fallendem Klick-Trend, gewichtet nach geschätztem Traffic und offenen Problemen.
            Die Auswahl treibt Score &amp; Link-Vorschläge. <ConfidenceBadge level="E" />
          </p>
          {data.refreshCandidates.length > 0 ? (
            <div className="cw-candidates">
              {data.refreshCandidates.map((candidate) => {
                const active = candidate.url === data.selectedUrl;
                return (
                  <a
                    key={candidate.url}
                    className={active ? "cw-candidate cw-candidate--active" : "cw-candidate"}
                    href={workspaceHref({ url: candidate.url, status: data.activeStatus })}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="cw-candidate__url">{candidate.url}</span>
                    <span className="facts">
                      <span className="fact">
                        <span className="fact__label">Klick-Trend</span>
                        <span
                          className={`fact__value ${
                            candidate.clicksTrend < 0 ? "cw-candidate__trend--down" : "cw-candidate__trend--up"
                          }`}
                        >
                          {candidate.clicksTrend > 0 ? "+" : ""}
                          {candidate.clicksTrend}
                        </span>
                      </span>
                      <span className="fact">
                        <span className="fact__label">Probleme</span>
                        <span className="fact__value">{candidate.openIssues}</span>
                      </span>
                      <span className="fact">
                        <span className="fact__label">Score</span>
                        <span className="fact__value">{candidate.refreshScore}</span>
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="muted">
              Noch keine Refresh-Kandidaten. Sobald die Google Search Console verbunden ist und Seiten
              an Klicks verlieren, erscheinen sie hier.
            </p>
          )}
        </section>

        {/* Content score — the DETAIL: only meaningful once a candidate (URL) is selected. */}
        <section className="card">
          <p className="kicker">Content-Score</p>
          {hasSelection ? (
            <>
              <p className="muted">
                Für <strong>{data.selectedUrl}</strong> — blendet Crawl-Health, offene Issues und
                Metrik-Trend. <ConfidenceBadge level="E" />
              </p>
              <ScoreGauge value={score?.score ?? null} label="Content" />
              <div className="cw-score-row">
                <span className="muted">{scoreBandLabel(score?.score ?? null)}</span>
              </div>
              {score && score.reasons.length > 0 ? (
                <ul className="cw-reasons">
                  {score.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Kein Score für diese URL ableitbar.</p>
              )}
              <div className="cw-action-row">
                <a className="button compact" href="#brief-erstellen">
                  Brief für diese URL erstellen ↓
                </a>
              </div>
              <WhyItMatters>
                Ein niedriger Score plus fallender Trend ist der stärkste Hinweis, dass sich ein Refresh
                lohnt.
              </WhyItMatters>
            </>
          ) : (
            <p className="muted cw-detail-hint">
              Wählen Sie links einen Refresh-Kandidaten, um Content-Score und interne Link-Vorschläge zu
              sehen.
            </p>
          )}
        </section>
      </div>
      ) : null}

      {/* Internal-link suggestions — DETAIL: only shown once a candidate is selected. */}
      {hasWorkspaceData && data.refreshCandidates.length > 0 && hasSelection ? (
      <section className="card">
        <p className="kicker">Interne Link-Vorschläge</p>
        <p className="muted">
          Aus dem echten Crawl-Link-Graph für <strong>{data.selectedUrl}</strong>. Mit „→ Brief“
          übernimmst du einen Vorschlag in die internen Links des geöffneten Briefs.{" "}
          <ConfidenceBadge level="A" />
        </p>
        {data.internalLinkSuggestions.length > 0 ? (
          <div className="cw-suggestions">
            {data.internalLinkSuggestions.map((suggestion) => (
              <div className="cw-suggestion" key={suggestion.url}>
                <div>
                  <div className="cw-suggestion__url">{suggestion.url}</div>
                  {suggestion.anchor ? (
                    <div className="cw-suggestion__reason">Anchor: {suggestion.anchor}</div>
                  ) : null}
                  <div className="cw-suggestion__reason">{suggestion.reason}</div>
                </div>
                {selectedBrief ? (
                  <form action={addInternalLinkAction}>
                    <input type="hidden" name="briefId" value={selectedBrief.id} />
                    <input type="hidden" name="linkUrl" value={suggestion.url} />
                    <input type="hidden" name="linkAnchor" value={suggestion.anchor ?? ""} />
                    <input type="hidden" name="linkReason" value={suggestion.reason} />
                    <button type="submit" className="button compact secondary">
                      → Brief
                    </button>
                  </form>
                ) : (
                  <span className="muted cw-suggestion__reason">Brief öffnen, um zu übernehmen</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Keine internen Link-Vorschläge für diese URL.</p>
        )}
      </section>
      ) : null}

      {/* Brief list + filter — part of the workspace machinery (shown once there is data). */}
      {hasWorkspaceData ? (
      <section className="card">
        <p className="kicker">Briefs</p>
        <p className="muted">
          Manuell gepflegte Content-Briefs für diese Website, nach Status filterbar. Briefs sind echte,
          persistierte Artefakte. <ConfidenceBadge level="A" />
        </p>
        <div className="cluster">
          <a className="button secondary compact" href="#brief-erstellen">+ Neuen Brief erstellen</a>
        </div>
        <div className="cw-filter" role="group" aria-label="Briefs nach Status filtern">
          {BRIEF_STATUS_FILTERS.map((status) => {
            const selected = status === data.activeStatus;
            return (
              <a
                key={status}
                href={workspaceHref({ url: data.selectedUrl, status })}
                className={selected ? "badge primary" : "badge"}
                aria-current={selected ? "true" : undefined}
              >
                {briefStatusLabel(status)}
              </a>
            );
          })}
        </div>
        {data.briefs.length > 0 ? (
          <div className="cw-brief-list">
            {data.briefs.map((brief) => {
              const active = selectedBrief?.id === brief.id;
              return (
                <a
                  key={brief.id}
                  className={active ? "cw-brief cw-brief--active" : "cw-brief"}
                  href={workspaceHref({
                    url: data.selectedUrl,
                    status: data.activeStatus,
                    briefId: brief.id,
                  })}
                  aria-current={active ? "true" : undefined}
                >
                  <div className="cw-brief__title">{brief.title}</div>
                  <div className="cw-brief__meta">
                    <span className={`badge ${STATUS_BADGE_TONE[brief.status] ?? ""}`.trim()}>
                      {briefStatusLabel(brief.status)}
                    </span>
                    <span>{brief.url}</span>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="muted">Keine Briefs im aktiven Filter.</p>
        )}
      </section>
      ) : null}

      {/* Brief editor (when one is open) */}
      {selectedBrief ? (
        <section className="card">
          <p className="kicker">Brief bearbeiten</p>
          <div className="badge-row">
            <span className={`badge ${STATUS_BADGE_TONE[selectedBrief.status] ?? ""}`.trim()}>
              {briefStatusLabel(selectedBrief.status)}
            </span>
            <span className="badge">{selectedBrief.url}</span>
          </div>

          <BriefEditor brief={selectedBrief} onSave={updateBriefAction} />

          {/* Lifecycle transitions */}
          <div className="cw-action-row" role="group" aria-label="Status-Verlauf">
            {availableTransitions(selectedBrief.status).map((target) => (
              <form key={target} action={transitionBriefAction}>
                <input type="hidden" name="briefId" value={selectedBrief.id} />
                <input type="hidden" name="status" value={target} />
                <button type="submit" className="button compact secondary">
                  {TRANSITION_LABELS[target] ?? target}
                </button>
              </form>
            ))}
          </div>

          {/* Bridge to proposal / MCP rail */}
          <div className="cw-action-row" role="group" aria-label="In Umsetzung übergeben">
            <form action={createProposalAction}>
              <input type="hidden" name="briefId" value={selectedBrief.id} />
              <input type="hidden" name="kind" value="dev_ticket" />
              <button type="submit" className="button compact" title="Erzeugt eine Aufgabe für Ihr Entwicklungs-Team">
                → Aufgabe für Entwickler
              </button>
            </form>
            <form action={createProposalAction}>
              <input type="hidden" name="briefId" value={selectedBrief.id} />
              <input type="hidden" name="kind" value="fix_pr" />
              <button type="submit" className="button compact" title="Bereitet eine Code-Änderung (Pull Request) als Vorschlag vor">
                → Code-Änderung vorbereiten
              </button>
            </form>
            <span className="muted cw-suggestion__reason">
              Macht aus diesem Brief einen konkreten Umsetzungs-Vorschlag, den Entwickler (oder ein KI-Agent)
              übernehmen können.
            </span>
          </div>
        </section>
      ) : null}

      {/* Create a new brief */}
      <section className="card" id="brief-erstellen">
        <p className="kicker">Neuen Brief erstellen</p>
        <p className="muted">
          Ein leerer, manuell zu befüllender Brief. URL ist mit dem gewählten Refresh-Kandidaten
          vorbelegt.
        </p>
        {data.connected && data.project && data.site ? (
          <form action={createBriefAction} className="cw-editor">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="siteId" value={siteId} />
            {opportunityId ? (
              <input type="hidden" name="opportunityId" value={opportunityId} />
            ) : null}
            <div className="cw-editor__fields">
              <label className="cw-field">
                <span className="cw-field__label">URL</span>
                <input
                  className="cw-input"
                  type="text"
                  name="url"
                  defaultValue={data.selectedUrl ?? ""}
                  placeholder="https://example.com/seite"
                  required
                />
              </label>
              <label className="cw-field">
                <span className="cw-field__label">Titel</span>
                <input className="cw-input" type="text" name="title" required />
              </label>
              <label className="cw-field">
                <span className="cw-field__label">Ziel-Thema</span>
                <input className="cw-input" type="text" name="targetTopic" />
              </label>
            </div>
            <div className="cw-editor__actions">
              <SubmitButton className="button" pendingLabel="wird erstellt …">
                Brief erstellen
              </SubmitButton>
            </div>
          </form>
        ) : (
          <p className="muted">Website + erreichbare API erforderlich.</p>
        )}
      </section>

      {data.briefs.length > 0 ? (
        <NextStep
          hint="Briefs gepflegt — fassen Sie den Fortschritt in einem Bericht zusammen."
          href="/reports"
          ctaLabel="Zu den Reports →"
        />
      ) : null}
    </>
  );
}
