/**
 * Rule-based "Kernbefund" builders — a deterministic, factual one-line summary assembled from numbers
 * the loaders already produce. No LLM, no interpretation beyond simple thresholds; keeps the
 * evidence-first line. Rendered by <SummaryHead>.
 */

export type VerdictTone = "good" | "warn" | "bad" | "neutral";

export interface Verdict {
  text: string;
  tone: VerdictTone;
}

const nf = (n: number): string => n.toLocaleString("de-DE");

/** Technical Audit: health + open issues + indexable URLs (+ health trend). */
export function deriveAuditVerdict(input: {
  health: number | null;
  healthDelta: number | null;
  openIssues: number;
  indexable: number | null;
}): Verdict | null {
  if (input.health === null && input.indexable === null && input.openIssues === 0) return null;

  const parts: string[] = [];
  let tone: VerdictTone = "neutral";

  if (input.health !== null) {
    parts.push(`Health ${nf(input.health)}/100`);
    tone = input.health >= 80 ? "good" : input.health >= 50 ? "warn" : "bad";
  }

  parts.push(input.openIssues > 0 ? `${nf(input.openIssues)} offene Issues` : "keine offenen Issues");
  if (input.openIssues > 0 && tone === "good") tone = "warn";

  if (input.indexable !== null) parts.push(`${nf(input.indexable)} indexierbare URLs`);

  let text = parts.join(" · ");
  if (input.healthDelta !== null && input.healthDelta !== 0) {
    const rising = input.healthDelta > 0;
    text += ` — Health ${rising ? "steigt" : "fällt"} (${rising ? "+" : ""}${nf(input.healthDelta)})`;
    if (!rising && tone === "good") tone = "warn";
  }

  return { text, tone };
}

/** Content & Chancen: opportunity backlog — total, active, quick wins, top priority. */
export function deriveOpportunitiesVerdict(input: {
  total: number;
  active: number;
  quickWins: number;
  topPriority: number | null;
}): Verdict | null {
  if (input.total === 0) return null;

  const parts = [`${nf(input.total)} Chancen`, `${nf(input.active)} aktiv`];
  let tone: VerdictTone = input.active > 0 ? "warn" : "neutral";
  if (input.quickWins > 0) {
    parts.push(`${nf(input.quickWins)} Quick Wins zuerst`);
    tone = "good";
  }

  let text = parts.join(" · ");
  if (input.topPriority !== null) text += ` — Top-Priorität ${nf(input.topPriority)}`;
  return { text, tone };
}

/** Keywords & Rankings: visibility index + avg position + tracked set (+ visibility trend). */
export function deriveKeywordsVerdict(input: {
  visibility: number | null;
  visibilityDelta: number | null;
  avgPosition: number | null;
  totalKeywords: number;
}): Verdict | null {
  if (input.totalKeywords === 0) return null;

  const parts: string[] = [];
  let tone: VerdictTone = "neutral";
  if (input.visibility !== null) {
    parts.push(`Visibility ${nf(input.visibility)}/100`);
    tone = input.visibility >= 60 ? "good" : input.visibility >= 30 ? "warn" : "bad";
  }
  if (input.avgPosition !== null) parts.push(`Ø Position ${input.avgPosition.toLocaleString("de-DE")}`);
  parts.push(`${nf(input.totalKeywords)} Keywords`);

  let text = parts.join(" · ");
  if (input.visibilityDelta !== null && input.visibilityDelta !== 0) {
    const rising = input.visibilityDelta > 0;
    text += ` — Sichtbarkeit ${rising ? "steigt" : "fällt"} (${rising ? "+" : ""}${nf(input.visibilityDelta)})`;
    if (!rising && tone === "good") tone = "warn";
  }
  return { text, tone };
}
