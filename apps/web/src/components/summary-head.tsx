import { MetricCard, type MetricCardProps } from "./metric-card";

export type VerdictTone = "good" | "warn" | "bad" | "neutral";

export interface SummaryHeadProps {
  /**
   * The "Kernbefund" — a rule-based, factual one-line summary of the screen's state, assembled
   * deterministically from existing numbers (no LLM). The single biggest overview lever: it answers
   * "how are we and what's the headline" before any scrolling.
   */
  verdict?: { text: string; tone?: VerdictTone };
  /** At-a-glance KPI cards rendered as a verdict-strip. */
  metrics: MetricCardProps[];
  /** verdict-strip column count; defaults to the metric count (clamped 2–5). */
  columns?: 2 | 3 | 4 | 5;
}

/**
 * SummaryHead — the constant "Schicht 1" across content-heavy screens: a prominent factual verdict
 * sentence over a row of KPI cards, so the most important answer is always in the viewport.
 */
export function SummaryHead({ verdict, metrics, columns }: SummaryHeadProps) {
  const cols = columns ?? (Math.min(5, Math.max(2, metrics.length)) as 2 | 3 | 4 | 5);
  return (
    <section className="summary-head" aria-label="Zusammenfassung">
      {verdict ? (
        <p className={`summary-head__verdict summary-head__verdict--${verdict.tone ?? "neutral"}`}>
          <span className="summary-head__dot" aria-hidden="true" />
          {verdict.text}
        </p>
      ) : null}
      <div className={`verdict-strip verdict-strip--${cols}`}>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  );
}
