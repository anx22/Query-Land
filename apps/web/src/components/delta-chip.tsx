/**
 * DeltaChip — renders a change value with direction arrow and accessible text.
 *
 * Design rules (ux-ui-sprint.md Teil 2 §3.2):
 *   - Always renders arrow glyph AND sr-only direction text — color is never the only signal.
 *   - Colors come from chartTheme.semantic (gain/loss/neutral) = CSS vars
 *     --success / --danger / --muted.
 *   - invertColors: for metrics where lower is better (e.g. ranking position),
 *     a negative value is green (gain) and a positive value is red (loss).
 *   - Server-renderable: no "use client" directive.
 *
 * Props:
 *   value        — number (required); sign determines direction
 *   format       — "delta" (default, +12.3) | "percent" (+12.3 %) | "raw" (no sign forced)
 *   unit         — optional string appended after value (e.g. "%", " Klicks")
 *   invertColors — boolean (default false); set true when lower = better (rankings)
 */

export type DeltaDirection = "up" | "down" | "flat";
export type DeltaFormat = "delta" | "percent" | "raw";

export interface DeltaChipProps {
  /** Numeric change value; sign → direction */
  value: number;
  /** How to format the displayed number */
  format?: DeltaFormat;
  /** Unit appended after the number */
  unit?: string;
  /**
   * When true, treats a negative value as gain (green) and positive as loss (red).
   * Use for metrics where lower is better, e.g. ranking position or load time.
   */
  invertColors?: boolean;
}

/**
 * Pure direction helper — unit-testable without rendering.
 *
 * @param value      — numeric delta
 * @param invert     — set true when lower is better
 * @returns "up" | "down" | "flat"
 */
export function deltaDirection(
  value: number,
  invert = false
): DeltaDirection {
  if (value === 0) return "flat";
  const isPositive = value > 0;
  // "up" = visually upward arrow, semantically good (green unless inverted)
  // When inverted: positive (going up) is bad, negative (going down) is good
  if (invert) {
    return isPositive ? "down" : "up";
  }
  return isPositive ? "up" : "down";
}

/** Formats the numeric value for display. */
function formatValue(value: number, format: DeltaFormat, unit?: string): string {
  const abs = Math.abs(value);
  let formatted: string;

  switch (format) {
    case "percent":
      formatted = `${value > 0 ? "+" : value < 0 ? "−" : ""}${abs.toLocaleString("de-DE", {
        maximumFractionDigits: 1,
      })} %`;
      break;
    case "raw":
      formatted = abs.toLocaleString("de-DE", { maximumFractionDigits: 1 });
      break;
    case "delta":
    default:
      formatted = `${value > 0 ? "+" : value < 0 ? "−" : ""}${abs.toLocaleString("de-DE", {
        maximumFractionDigits: 1,
      })}`;
  }

  return unit ? `${formatted}${unit}` : formatted;
}

const ARROW: Record<DeltaDirection, string> = {
  up: "▲",
  down: "▼",
  flat: "–",
};

const DIRECTION_LABEL: Record<DeltaDirection, string> = {
  up: "gestiegen",
  down: "gesunken",
  flat: "unverändert",
};

/**
 * DeltaChip — server-renderable change indicator.
 *
 * @example
 *   <DeltaChip value={12} />
 *   <DeltaChip value={-3} invertColors unit=" Plätze" />
 *   <DeltaChip value={0} format="percent" />
 */
export function DeltaChip({
  value,
  format = "delta",
  unit,
  invertColors = false,
}: DeltaChipProps) {
  const dir = deltaDirection(value, invertColors);
  const displayValue = formatValue(value, format, unit);

  return (
    <span className={`delta-chip delta-chip--${dir}`}>
      {/* Arrow glyph — visual direction signal */}
      <span className="delta-chip__arrow" aria-hidden="true">
        {ARROW[dir]}
      </span>

      {/* Formatted value */}
      <span className="delta-chip__value" aria-hidden="true">
        {displayValue}
      </span>

      {/* Screen-reader text: direction + value */}
      <span className="sr-only">
        {DIRECTION_LABEL[dir]}: {displayValue}
      </span>
    </span>
  );
}
