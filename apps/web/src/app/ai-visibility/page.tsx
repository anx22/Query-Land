import "../../features/ai-visibility/ai-visibility.css";

import type { AeoAssessment } from "@seo-tool/domain-model";
import { PROPOSAL_KINDS } from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
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
          <p className="kicker">Modul 6 · Answer Engine Optimization</p>
          <h1>
            <TermTooltip term="AI-Visibility / Citation">KI-Sichtbarkeit</TermTooltip> &amp;{" "}
            <TermTooltip term="AEO">AEO</TermTooltip>
          </h1>
          <p>
            Verfolgt, ob die eigene Domain in LLM-Antworten auf getrackte Prompts zitiert oder
            erwähnt wird, und bewertet Seiten heuristisch auf Antwort-Engine-Reife.
          </p>
          <div className="badge-row">
            <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
            <span className="badge">{data.selectedSite?.baseUrl ?? "keine Site"}</span>
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
          {!data.connected ? (
            <p className="notice danger">
              {data.errorMessage} · Erwartete API: {data.apiBaseUrl}
            </p>
          ) : null}
        </section>

        {/* Score + facts */}
        <section className="card">
          <p className="kicker">Citation-Anteil · Klasse E</p>
          <h2>AI-Visibility-Score</h2>
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
          <p className="kicker">Citation-Matrix · Klasse E</p>
          <h2>Prompts × zitiert?</h2>
          <p>
            Jede Zeile ist ein getrackter Prompt; „zitiert?" zeigt den letzten Snapshot
            (● zitiert · ◐ erwähnt · ○ nicht zitiert · – kein Snapshot). LLM-Signal, kein Beleg.
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
          <p className="kicker">Answer Engine Optimization · Klasse A</p>
          <h2>AEO-Analyse</h2>
          <p>
            Heuristische, content-basierte Checks, ob eine Seite für Antwort-Engines aufbereitet ist.
            Die Bewertung erbt die Crawl-Konfidenz (Klasse A) — deterministisch und als Evidenz
            zulässig.
          </p>

          {data.selectedSite ? (
            <form action={scanAeoAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="siteId" value={data.selectedSite.id} />
              <div className="form-row">
                <label>
                  URL
                  <input type="text" name="url" placeholder="https://example.com/seite" required />
                </label>
              </div>
              <label>
                HTML-Inhalt
                <textarea
                  name="content"
                  rows={4}
                  placeholder="Füge hier den HTML-Inhalt der Seite ein…"
                  required
                />
              </label>
              <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>
                AEO-Scan starten
              </button>
            </form>
          ) : (
            <p className="notice warning">
              Keine Site konfiguriert. Lege zuerst eine Site in den Einstellungen an, um AEO-Scans
              durchzuführen.
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
              <p className="ai-empty__title">Noch keine AEO-Assessments</p>
              <p className="ai-empty__hint">
                Starte oben einen Scan, um eine Seite auf Antwort-Engine-Reife zu prüfen.
              </p>
            </div>
          )}
        </section>

        {/* Proposals — review-gated */}
        <section className="card">
          <p className="kicker">MCP-Schreibtools · reviewpflichtig</p>
          <h2>Proposals</h2>
          <p>
            Dev-Tickets und Fix-PR-Vorschläge entstehen im Status „Vorgeschlagen" und werden erst
            nach manueller Prüfung aktiviert — keine automatischen Produktiv-Änderungen.
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
  if (singleParam(params?.scanned)) return { kind: "success", message: "AEO-Scan abgeschlossen (Klasse A)." };
  if (singleParam(params?.proposed)) return { kind: "success", message: "Proposal erstellt — wartet auf Review." };
  const transition = singleParam(params?.transition);
  if (transition) return { kind: "success", message: `Proposal-Status gewechselt zu ${transition}.` };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
