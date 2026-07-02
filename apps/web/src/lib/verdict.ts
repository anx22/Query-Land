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
