/**
 * ProposalsList (spec §4.12 / Teil 3 §J) — dev-ticket / fix-PR proposals,
 * review-gated. MCP write-tools only ever produce reviewable artefacts in status
 * "proposed"; a human accepts/rejects — never an automatic production mutation.
 *
 * Server-renderable (no "use client"): it renders <form action={serverAction}>
 * for the review transitions. It imports only the API-free label helpers from
 * ai-logic.ts; the server actions live in the route's actions.ts.
 */

import type { Proposal } from "@seo-tool/domain-model";
import { transitionProposalAction } from "../../app/ai-visibility/actions";
import {
  proposalKindLabel,
  proposalStatusBadge,
  proposalStatusLabel,
} from "./ai-logic";

export interface ProposalsListProps {
  proposals: Proposal[];
  connected: boolean;
}

function formatDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "—";
  return new Date(parsed).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

export function ProposalsList({ proposals, connected }: ProposalsListProps) {
  if (proposals.length === 0) {
    return (
      <div className="ai-empty">
        <p className="ai-empty__title">Noch keine Proposals</p>
        <p className="ai-empty__hint">
          Erstelle oben ein Proposal oder lass MCP-Schreibtools ein Dev-Ticket bzw. einen Fix-PR zur
          Review vorschlagen. Vorschläge starten im Status „Vorgeschlagen" und werden erst nach
          manueller Prüfung aktiviert.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-proposals">
      {proposals.map((proposal) => (
        <article className="ai-proposal" key={proposal.id}>
          <div className="ai-proposal__head">
            <span className="ai-proposal__title">{proposal.title}</span>
            <span className="badge">{proposalKindLabel(proposal.kind)}</span>
            <span className={`badge ${proposalStatusBadge(proposal.status)}`}>
              {proposalStatusLabel(proposal.status)}
            </span>
          </div>
          <p className="ai-proposal__body">{proposal.body}</p>
          <span className="ai-proposal__meta">
            Quelle: {proposal.source} · angelegt {formatDate(proposal.createdAt)}
          </span>
          {proposal.status === "proposed" ? (
            <div className="inline-actions">
              <form action={transitionProposalAction}>
                <input type="hidden" name="proposalId" value={proposal.id} />
                <input type="hidden" name="status" value="accepted" />
                <button className="button compact" type="submit" disabled={!connected}>
                  Akzeptieren
                </button>
              </form>
              <form action={transitionProposalAction}>
                <input type="hidden" name="proposalId" value={proposal.id} />
                <input type="hidden" name="status" value="rejected" />
                <button className="button secondary compact" type="submit" disabled={!connected}>
                  Verwerfen
                </button>
              </form>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
