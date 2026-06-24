import type { ReactNode } from "react";
import { ConfidenceBadge, type ConfidenceLevel } from "../../components/confidence-badge";

/**
 * SectionCard — a numbered dossier section with a kicker title and an optional
 * ConfidenceBadge. Server-renderable. Layout reuses the global `card` class.
 */
export interface SectionCardProps {
  /** Section ordinal (1..n) shown as a pill before the title. */
  num: number;
  /** Section title (kicker style). */
  title: ReactNode;
  /** Evidence level for the whole section's numbers (A..E). Omit to hide. */
  confidence?: ConfidenceLevel;
  /** Whether to show the confidence text label (default false → compact). */
  confidenceLabel?: boolean;
  children: ReactNode;
}

export function SectionCard({ num, title, confidence, confidenceLabel = false, children }: SectionCardProps) {
  return (
    <div className="card">
      <div className="dossier-section-head">
        <span className="dossier-section-num" aria-hidden="true">
          {num}
        </span>
        <p className="kicker">{title}</p>
        <span className="dossier-section-spacer" />
        {confidence ? <ConfidenceBadge level={confidence} showLabel={confidenceLabel} /> : null}
      </div>
      {children}
    </div>
  );
}

/** A calm in-card empty-state line. */
export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="dossier-empty">{children}</p>;
}
