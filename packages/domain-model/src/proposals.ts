// Proposals (§4.4, Welle 7). MCP-Schreibtools erzeugen ausschließlich PRÜFBARE Artefakte
// (Dev-Tickets, Fix-PR-Vorschläge) im Status "proposed" — niemals direkte Produktiv-Mutationen.
// Ein Mensch akzeptiert/verwirft; so bleibt jeder Agenten-Schreibvorgang reviewpflichtig.

export type ProposalKind = "dev_ticket" | "fix_pr";
export type ProposalStatus = "proposed" | "accepted" | "rejected";

export const PROPOSAL_KINDS: readonly ProposalKind[] = ["dev_ticket", "fix_pr"];
export const PROPOSAL_STATUSES: readonly ProposalStatus[] = ["proposed", "accepted", "rejected"];

export interface Proposal {
  id: string;
  projectId: string;
  kind: ProposalKind;
  title: string;
  body: string;
  opportunityId: string | null;
  status: ProposalStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}
