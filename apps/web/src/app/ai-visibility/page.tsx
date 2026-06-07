import type { AeoAssessment, AiPrompt, Proposal, ProposalStatus } from "@seo-tool/domain-model";
import { PROPOSAL_KINDS } from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { loadAiVisibility } from "../../features/ai-visibility";
import { createPromptAction, createProposalAction, recordSnapshotAction, scanAeoAction, transitionProposalAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadAiVisibility();
  const feedback = feedbackMessage(params);

  return (
    <AppShell activePath="/ai-visibility">
      {/* Hero card */}
      <section className="card hero-card">
        <p className="kicker">AI Visibility &amp; AEO · Modul 6</p>
        <h1>AI-Sichtbarkeit &amp; Answer Engine Optimization</h1>
        <p>
          Verfolgt, ob die eigene Domain in LLM-Antworten auf getrackte Prompts zitiert/erwähnt wird, und bewertet Seiten heuristisch auf AEO-Readiness.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.selectedSite?.baseUrl ?? "keine Site"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
          <span className="badge warning">Klasse E · Signal, kein Evidenz-Beleg</span>
        </div>
        <p className="notice warning">
          <strong>KI-Hinweis (kein Beleg):</strong> LLM-Interpretation ist Konfidenzklasse E und darf nicht als Evidenzbeleg verwendet werden. Diese Daten sind ein Signal, kein deterministischer Nachweis.
        </p>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}

        <form action={createPromptAction}>
          <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
          <div className="form-row">
            <label>
              Prompt
              <input type="text" name="prompt" placeholder="z. B. Best SEO tools for small businesses" required />
            </label>
            <label>
              Markt (optional)
              <input type="text" name="market" placeholder="z. B. de, en-US" />
            </label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Prompt hinzufügen</button>
          </div>
        </form>
      </section>

      {/* Metric grid */}
      <section className="metric-grid">
        <MetricCard label="AI-Visibility Score" value={data.visibility ? `${data.visibility.score}%` : "—"} note="Anteil Prompts mit Zitat (Klasse E)" />
        <MetricCard label="Getrackte Prompts" value={String(data.visibility?.prompts ?? data.prompts.length)} note="Prompts in Beobachtung" />
        <MetricCard label="Zitierte Prompts" value={String(data.visibility?.citedPrompts ?? "—")} note="Prompts mit Domain-Zitat" />
        <MetricCard label="Brand Mentions" value={String(data.visibility?.brandMentions ?? "—")} note="Erwähnungen ohne Zitat" />
      </section>

      {/* Prompts card */}
      <section className="card">
        <p className="kicker">Getrackte Prompts · Klasse E</p>
        <h2>Prompts</h2>
        {data.prompts.length > 0 ? (
          <div className="table-list">
            {data.prompts.map((prompt) => (
              <PromptRow key={prompt.id} prompt={prompt} projectId={data.selectedProject?.id ?? ""} connected={data.connected} />
            ))}
          </div>
        ) : (
          <p>Noch keine Prompts. Füge oben einen Prompt hinzu, um die LLM-Sichtbarkeit zu tracken.</p>
        )}
      </section>

      {/* AEO card */}
      <section className="card">
        <p className="kicker">Answer Engine Optimization · Klasse A</p>
        <h2>AEO-Analyse</h2>
        <p>
          Heuristische, content-basierte Checks, ob eine Seite für Antwort-Engines optimiert ist. Erbt Crawl-Confidence (Klasse A) — deterministisch und als Evidenz zulässig.
        </p>
        {data.selectedSite ? (
          <form action={scanAeoAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <input type="hidden" name="siteId" value={data.selectedSite.id} />
            <div className="form-row">
              <label>
                URL
                <input type="text" name="url" placeholder="https://example.com/page" required />
              </label>
            </div>
            <label>
              HTML-Inhalt
              <textarea name="content" rows={4} placeholder="Füge hier den HTML-Inhalt der Seite ein..." required />
            </label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>AEO-Scan starten</button>
          </form>
        ) : (
          <p className="notice warning">Kein Site konfiguriert. Bitte erst eine Site in den Einstellungen anlegen, um AEO-Scans durchzuführen.</p>
        )}

        {data.aeo.length > 0 ? (
          <div className="table-list">
            {data.aeo.map((assessment) => (
              <AeoRow key={assessment.id} assessment={assessment} />
            ))}
          </div>
        ) : (
          <p>Noch keine AEO-Assessments. Starte oben einen Scan, um eine Seite zu analysieren.</p>
        )}
      </section>

      {/* Proposals card */}
      <section className="card">
        <p className="kicker">MCP-Schreibtools · reviewpflichtig</p>
        <h2>Proposals</h2>
        <p>
          Vorschläge entstehen im Status „proposed" und werden erst nach manueller Prüfung aktiviert — keine automatischen Produktiv-Änderungen.
        </p>

        <form action={createProposalAction}>
          <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
          <div className="form-row">
            <label>
              Art
              <select name="kind" required>
                {PROPOSAL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
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
            <textarea name="body" rows={3} placeholder="Detaillierte Beschreibung des Proposals..." required />
          </label>
          <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Proposal erstellen</button>
        </form>

        {data.proposals.length > 0 ? (
          <div className="table-list">
            {data.proposals.map((proposal) => (
              <ProposalRow key={proposal.id} proposal={proposal} connected={data.connected} />
            ))}
          </div>
        ) : (
          <p>Noch keine Proposals. Erstelle oben ein Proposal oder nutze MCP-Schreibtools, um Artefakte zur Review vorzuschlagen.</p>
        )}
      </section>
    </AppShell>
  );
}

function PromptRow({ prompt, projectId, connected }: { prompt: AiPrompt; projectId: string; connected: boolean }) {
  return (
    <article>
      <strong>{prompt.prompt}</strong>
      {prompt.market ? <span className="badge">{prompt.market}</span> : null}
      <span className="muted">{new Date(prompt.createdAt).toLocaleDateString("de-DE")}</span>
      <div className="inline-actions">
        <form action={recordSnapshotAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="promptId" value={prompt.id} />
          <button className="button secondary compact" type="submit" disabled={!connected}>Snapshot erfassen</button>
        </form>
      </div>
    </article>
  );
}

function AeoRow({ assessment }: { assessment: AeoAssessment }) {
  const passedChecks = assessment.checks.filter((c) => c.passed).length;
  return (
    <article>
      <strong>{assessment.url}</strong>
      <span className={`badge ${assessment.score >= 60 ? "success" : assessment.score >= 40 ? "warning" : "danger"}`}>Score: {assessment.score}%</span>
      <span>{passedChecks}/{assessment.checks.length} Checks bestanden</span>
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

function ProposalRow({ proposal, connected }: { proposal: Proposal; connected: boolean }) {
  return (
    <article>
      <strong>{proposal.title}</strong>
      <span className="badge">{proposal.kind}</span>
      <span className={`status ${proposal.status}`}>{proposal.status}</span>
      <span>{proposal.body}</span>
      <span className="muted">Quelle: {proposal.source} · {new Date(proposal.createdAt).toLocaleDateString("de-DE")}</span>
      {proposal.status === "proposed" ? (
        <div className="inline-actions">
          <ProposalTransitionForm proposalId={proposal.id} status="accepted" disabled={!connected} label="Akzeptieren" />
          <ProposalTransitionForm proposalId={proposal.id} status="rejected" disabled={!connected} label="Verwerfen" />
        </div>
      ) : null}
    </article>
  );
}

function ProposalTransitionForm({ proposalId, status, disabled, label }: { proposalId: string; status: ProposalStatus; disabled: boolean; label: string }) {
  return (
    <form action={transitionProposalAction}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="status" value={status} />
      <button className={`button ${status === "rejected" ? "secondary" : ""} compact`} type="submit" disabled={disabled}>{label}</button>
    </form>
  );
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.created)) return { kind: "success", message: "Prompt erfolgreich hinzugefügt." };
  if (singleParam(params?.snapshot)) return { kind: "success", message: "Snapshot erfasst (Klasse E)." };
  if (singleParam(params?.scanned)) return { kind: "success", message: "AEO-Scan abgeschlossen (Klasse A)." };
  if (singleParam(params?.proposed)) return { kind: "success", message: "Proposal erstellt — wartet auf Review." };
  const transition = singleParam(params?.transition);
  if (transition) return { kind: "success", message: `Proposal-Status gewechselt zu ${transition}.` };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
