import "../../features/ai-visibility/ai-visibility.css";

import type { AeoAssessment } from "@seo-tool/domain-model";
import { PROPOSAL_KINDS } from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { Icon } from "../../components/icon";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { TermTooltip } from "../../components/term-tooltip";
import { WhyItMatters } from "../../components/why-it-matters";
import { ScoreGauge } from "../../components/charts/score-gauge";
import { CitationMatrix } from "../../features/ai-visibility/citation-matrix";
import { ProposalsList } from "../../features/ai-visibility/proposals-list";
import { toMatrixRow, proposalKindLabel } from "../../features/ai-visibility/ai-logic";
import { loadAiVisibilityOverview } from "../../lib/ai-visibility-api";
import {
  createPromptAction,
  createProposalAction,
  recordSnapshotAction,
  scanAeoAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await loadAiVisibilityOverview();
  const feedback = feedbackMessage(params);

  const projectId = data.selectedProject?.id ?? "";
  const matrixRows = data.citationRows.map((row) =>
    toMatrixRow({
      promptId: row.prompt.id,
      prompt: row.prompt.prompt,
      market: row.prompt.market ?? "",
      snapshotCount: row.snapshotCount,
      latest: row.latest
        ? {
            ourCited: row.latest.ourCited,
            brandMentioned: row.latest.brandMentioned,
            citedDomains: row.latest.citedDomains,
            capturedAt: row.latest.capturedAt,
          }
        : null,
    }),
  );

  const score = data.visibility?.score ?? null;

  return (
    <AppShell activePath="/ai-visibility">
      <div className="ai-root">
        {/* Hero */}
        <section className="card hero-card">
          <p className="kicker">KI-Suche · Sichtbarkeit</p>
          <h1>
            <TermTooltip term="AI-Visibility / Citation">KI-Sichtbarkeit</TermTooltip> &amp;{" "}
            <TermTooltip term="AEO">AEO</TermTooltip>
          </h1>
          <p>
            Wenn Leute ChatGPT, Gemini &amp; Co. etwas fragen — wird Ihre Website in der Antwort
            genannt? Hier sehen Sie, ob Ihre Domain in KI-Antworten zitiert wird und ob Ihre Seiten
            dafür gut aufbereitet sind.
          </p>
          <div className="badge-row">
            <span className={data.connected ? "badge success" : "badge danger"}>
              {data.connected ? "API verbunden" : "API offline"}
            </span>
          </div>

          {/* MANDATORY Class-E notice — serious-zone, strict, factual */}
          <div className="ai-classE-notice" role="note">
            <div className="ai-classE-notice__head">
              <ConfidenceBadge level="E" />
              <span className="ai-classE-notice__title">KI-Hinweis, kein Beleg</span>
            </div>
            <p className="ai-classE-notice__text">
              KI-Sichtbarkeit beruht auf LLM-Interpretation und ist{" "}
              <TermTooltip term="Evidenz / Konfidenz (A–E)">Konfidenzklasse E</TermTooltip>. Diese
              Werte sind ein <strong>Signal, kein Beleg</strong>. Sie dürfen nicht als Evidenz für
              Chancen oder Entscheidungen verwendet werden und sind kein deterministischer Nachweis.
            </p>
          </div>

          {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
          {!data.connected ? <OfflineNotice /> : null}
        </section>

        {/* Score + facts */}
        <section className="card">
          <p className="kicker">Wie oft wird Ihre Domain in KI-Antworten genannt?</p>
          <h2>KI-Sichtbarkeits-Score</h2>
          <WhyItMatters>
            Zeigt sachlich, in welchem Anteil getrackter Prompts die eigene Domain genannt wird — als
            Frühwarn-Signal, nicht als Beweis.
          </WhyItMatters>
          <div className="ai-scores">
            <div className="ai-gauge">
              <ScoreGauge value={score} max={100} label="Citation-Anteil" size={180} />
              <span className="badge warning">Klasse E · Signal</span>
            </div>
            <div className="ai-scores__facts">
              <div className="ai-fact">
                <span className="ai-fact__value">{data.visibility?.prompts ?? data.prompts.length}</span>
                <span className="ai-fact__label">Getrackte Prompts</span>
              </div>
              <div className="ai-fact">
                <span className="ai-fact__value">{data.visibility?.citedPrompts ?? "—"}</span>
                <span className="ai-fact__label">Zitierte Prompts</span>
              </div>
              <div className="ai-fact">
                <span className="ai-fact__value">{data.visibility?.brandMentions ?? "—"}</span>
                <span className="ai-fact__label">Marken-Erwähnungen</span>
              </div>
              <div className="ai-fact">
                <span className="ai-fact__value">{score !== null ? `${score} %` : "—"}</span>
                <span className="ai-fact__label">Citation-Anteil</span>
              </div>
            </div>
          </div>
        </section>

        {/* Citation matrix + add-prompt form */}
        <section className="card">
          <p className="kicker">Welche Frage, welche Nennung?</p>
          <h2>Fragen × zitiert?</h2>
          <p>
            Jede Zeile ist eine getrackte Frage (Prompt); „zitiert?" zeigt das letzte Ergebnis
            (● zitiert · ◐ erwähnt · ○ nicht zitiert · – noch nicht geprüft). KI-Signal, kein Beleg.
          </p>

          <form action={createPromptAction} className="form-row">
            <input type="hidden" name="projectId" value={projectId} />
            <label>
              Prompt
              <input
                type="text"
                name="prompt"
                placeholder="z. B. Beste SEO-Tools für kleine Unternehmen"
                required
              />
            </label>
            <label>
              Markt (optional)
              <input type="text" name="market" placeholder="z. B. de, en-US" />
            </label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>
              Prompt aufnehmen
            </button>
          </form>

          <CitationMatrix rows={matrixRows} />

          {matrixRows.length > 0 ? (
            <form action={recordSnapshotAction} className="inline-actions">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="promptId" value={data.prompts[0]?.id ?? ""} />
              <button
                className="button secondary compact"
                type="submit"
                disabled={!data.connected}
                title="Erfasst einen neuen Snapshot für den zuletzt aufgenommenen Prompt"
              >
                Snapshot erfassen (neuester Prompt)
              </button>
            </form>
          ) : null}
        </section>

        {/* AEO — Class A (deterministic, content-derived) */}
        <section className="card">
          <p className="kicker">Ist Ihre Seite KI-tauglich aufbereitet?</p>
          <h2>AEO-Analyse</h2>
          <p>
            Prüft anhand des Seiteninhalts, ob eine Seite so aufbereitet ist, dass KI-Antwortdienste
            sie gut verwenden können (klare Struktur, Fragen &amp; Antworten, belastbare Fakten).
            Basiert auf echten Crawl-Daten — als Beleg verwendbar.
          </p>

          {data.selectedSite ? (
            <form action={scanAeoAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="siteId" value={data.selectedSite.id} />
              <div className="form-row">
                <label>
                  URL der Seite
                  <input type="url" name="url" placeholder="https://example.com/seite" required />
                </label>
              </div>
              <p className="form-hint muted">
                Wir rufen den Seiteninhalt automatisch ab und prüfen die KI-Tauglichkeit — kein Kopieren nötig.
              </p>
              <details className="advanced-section">
                <summary>
                  <span className="advanced-section__title">Erweitert</span>
                  <span className="advanced-section__hint">
                    Inhalt manuell einfügen — nur nötig für Seiten mit Login oder reinem JavaScript.
                  </span>
                </summary>
                <label>
                  Seiteninhalt (optional)
                  <textarea name="content" rows={4} placeholder="Quelltext der Seite hier einfügen…" />
                </label>
              </details>
              <div className="locked-action">
                <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>
                  Seite analysieren
                </button>
                {!data.connected || !data.selectedProject ? (
                  <span className="locked-action__reason">
                    <Icon name="lock" />
                    {!data.connected ? "API nicht erreichbar." : "Zuerst eine Website anlegen."}
                  </span>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="notice warning">
              Noch keine Website hinterlegt. <a href="/projects">Zuerst eine Website hinzufügen →</a>{" "}
              danach können Sie hier Seiten auf KI-Lesbarkeit prüfen.
            </p>
          )}

          {data.aeo.length > 0 ? (
            <div className="table-list">
              {data.aeo.map((assessment) => (
                <AeoRow key={assessment.id} assessment={assessment} />
              ))}
            </div>
          ) : (
            <div className="ai-empty">
              <p className="ai-empty__title">Noch keine Analyse durchgeführt</p>
              <p className="ai-empty__hint">
                Füllen Sie oben das Formular aus, um eine Seite auf KI-Tauglichkeit zu prüfen.
              </p>
            </div>
          )}
        </section>

        {/* Proposals — review-gated */}
        <section className="card">
          <p className="kicker">Aufgaben &amp; Vorschläge</p>
          <h2>Vorschläge</h2>
          <p>
            Aus Befunden entstehen Aufgaben- und Fix-Vorschläge im Status „Vorgeschlagen". Sie werden
            erst nach manueller Prüfung aktiviert — nichts wird automatisch produktiv geändert.
          </p>

          <form action={createProposalAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="form-row">
              <label>
                Art
                <select name="kind" required>
                  {PROPOSAL_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {proposalKindLabel(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Titel
                <input type="text" name="title" placeholder="Kurzbeschreibung des Proposals" required />
              </label>
            </div>
            <label>
              Beschreibung
              <textarea name="body" rows={3} placeholder="Detaillierte Beschreibung des Proposals…" required />
            </label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>
              Proposal erstellen
            </button>
          </form>

          <ProposalsList proposals={data.proposals} connected={data.connected} />
        </section>
      </div>
    </AppShell>
  );
}

function AeoRow({ assessment }: { assessment: AeoAssessment }) {
  const passedChecks = assessment.checks.filter((c) => c.passed).length;
  const variant = assessment.score >= 60 ? "success" : assessment.score >= 40 ? "warning" : "danger";
  return (
    <article>
      <strong>{assessment.url}</strong>
      <span className={`badge ${variant}`}>Score: {assessment.score}%</span>
      <span>
        {passedChecks}/{assessment.checks.length} Checks bestanden
      </span>
      <span className="muted">
        {assessment.checks.map((check) => (
          <span key={check.check} className={check.passed ? "check-pass" : "check-fail"}>
            {check.passed ? "✓" : "✗"} {check.check}{" "}
          </span>
        ))}
      </span>
      <span className="muted">{new Date(assessment.assessedAt).toLocaleDateString("de-DE")}</span>
    </article>
  );
}

function feedbackMessage(
  params: Record<string, string | string[] | undefined> | undefined,
): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.created)) return { kind: "success", message: "Prompt aufgenommen." };
  if (singleParam(params?.snapshot)) return { kind: "success", message: "Snapshot erfasst (Klasse E — Signal, kein Beleg)." };
  if (singleParam(params?.scanned)) return { kind: "success", message: "AEO-Analyse abgeschlossen (Klasse A)." };
  if (singleParam(params?.proposed)) return { kind: "success", message: "Proposal erstellt — wartet auf Review." };
  const transition = singleParam(params?.transition);
  if (transition) return { kind: "success", message: `Proposal-Status gewechselt zu ${transition}.` };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
