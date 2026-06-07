/**
 * ConfidenceBadge — renders the A–E evidence scale as an accessible pill.
 *
 * Design rules (ux-ui-sprint.md Teil 1 §5 / Teil 2 §2.3 / Teil 2 §3.1):
 *   - Always shows letter + text label — color is NEVER the only signal.
 *   - Colors come from CSS custom properties (--conf-x / --conf-x-soft) that
 *     are defined in globals.css and mirrored by chartTheme.confidence.
 *   - Server-renderable: no "use client" directive.
 *
 * Props:
 *   level       — "A" | "B" | "C" | "D" | "E"  (required)
 *   showLabel   — boolean (default true) — whether to show the text label
 */

export type ConfidenceLevel = "A" | "B" | "C" | "D" | "E";

export interface ConfidenceMeta {
  /** Short Klartext-Label shown in the badge */
  label: string;
  /** Longer description for tooltips / screen readers */
  description: string;
  /** Data source shown in tooltip (Teil 1 §5) */
  source: string;
}

/** Pure mapping function — unit-testable without rendering. */
export function confidenceMeta(level: ConfidenceLevel): ConfidenceMeta {
  switch (level) {
    case "A":
      return {
        label: "Gesichert",
        description: "Eigene Daten (Crawl, Logs, CMS, GA4, Lighthouse)",
        source: "Eigene Daten",
      };
    case "B":
      return {
        label: "Beobachtet",
        description: "Google/eigene API (GSC, PageSpeed)",
        source: "Google/eigene API",
      };
    case "C":
      return {
        label: "Gemessen (SERP)",
        description: "Beobachtete Suchergebnisse",
        source: "Beobachtete Suchergebnisse",
      };
    case "D":
      return {
        label: "Geschätzt",
        description: "Drittanbieter-Schätzung",
        source: "Drittanbieter",
      };
    case "E":
      return {
        label: "KI-Hinweis (kein Beleg)",
        description: "LLM-Interpretation — nie als Evidenz",
        source: "LLM-Interpretation",
      };
  }
}

export interface ConfidenceBadgeProps {
  /** Evidence level A (strongest) to E (weakest) */
  level: ConfidenceLevel;
  /** Show the text label alongside the dot and letter (default: true) */
  showLabel?: boolean;
}

/**
 * ConfidenceBadge — server-renderable confidence/evidence pill.
 *
 * @example
 *   <ConfidenceBadge level="A" />
 *   <ConfidenceBadge level="E" showLabel={false} />
 */
export function ConfidenceBadge({
  level,
  showLabel = true,
}: ConfidenceBadgeProps) {
  const meta = confidenceMeta(level);

  return (
    <span
      className={`confidence-badge confidence-badge--${level}`}
      title={`Konfidenz ${level}: ${meta.description}`}
      aria-label={`Konfidenz ${level} — ${meta.label}`}
    >
      {/* Colored dot — visual signal (not the only one) */}
      <span className="confidence-badge__dot" aria-hidden="true" />

      {/* Letter — always visible */}
      <span className="confidence-badge__letter" aria-hidden="true">
        {level}
      </span>

      {/* Text label — color is never the only signal */}
      {showLabel && (
        <span className="confidence-badge__label">{meta.label}</span>
      )}
    </span>
  );
}
