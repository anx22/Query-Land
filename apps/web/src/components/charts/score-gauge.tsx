"use client";

/**
 * ScoreGauge — SVG half-circle arc gauge for Health Score / Visibility-Index (UX-1).
 *
 * Renders a pure-SVG semicircular gauge (no recharts needed for this simple shape).
 * Color is functional (green/amber/danger) — never brand-orange.
 *
 * Serious-Zone: number and color are factual; no metaphor.
 * A11y: role="img", aria-label, SVG <title>.
 * Responsive: 100 % width, height auto from viewBox.
 * Empty/zero state: renders empty arc with "—".
 *
 * Props:
 *   value      — 0–100 numeric score (required)
 *   max        — maximum value (default 100)
 *   label      — accessible + displayed label (default "Score")
 *   size       — diameter in px of the SVG (default 160)
 */

export interface ScoreGaugeProps {
  /** Numeric score 0–max */
  value: number | null;
  /** Maximum value (default 100) */
  max?: number;
  /** Label shown below the score number and used as aria-label */
  label?: string;
  /** SVG diameter in px (default 160) */
  size?: number;
}

/**
 * Determine fill color by score thresholds — functional, not brand.
 * Teil 2 §4.10: Füllfarbe funktional nach Schwellen (Grün/Amber/Danger).
 */
export function gaugeColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.7) return "var(--success)";
  if (pct >= 0.4) return "var(--warning)";
  return "var(--danger)";
}

/** Compute the SVG arc path for a semicircle from 180° to 180°+angle. */
function arcPath(cx: number, cy: number, r: number, fraction: number): string {
  // Clamp fraction 0–1
  const f = Math.max(0, Math.min(1, fraction));
  if (f === 0) return "";
  if (f >= 1) {
    // Full semicircle — special case (arc flags)
    return [
      `M ${cx - r} ${cy}`,
      `A ${r} ${r} 0 0 1 ${cx + r} ${cy}`,
    ].join(" ");
  }
  // Semicircle sweeps from left to right (180° → 0°)
  const angle = Math.PI * (1 - f); // start is π, we move toward 0
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  return [
    `M ${cx - r} ${cy}`,
    `A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`,
  ].join(" ");
}

export function ScoreGauge({
  value,
  max = 100,
  label = "Score",
  size = 160,
}: ScoreGaugeProps) {
  const hasValue = value !== null && Number.isFinite(value);
  const safeValue = hasValue ? Math.max(0, Math.min(max, value as number)) : 0;
  const fraction = max > 0 ? safeValue / max : 0;

  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.1; // 10 % of diameter
  const r = (size - strokeWidth) / 2;

  const trackColor = "var(--line)";
  const fillColor = hasValue ? gaugeColor(safeValue, max) : "var(--line)";
  const displayValue = hasValue ? Math.round(safeValue).toLocaleString("de-DE") : "—";

  const trackPath = arcPath(cx, cy, r, 1);
  const fillArcPath = arcPath(cx, cy, r, fraction);

  const ariaLabel = `${label}: ${displayValue} von ${max}`;

  return (
    <div
      className="score-gauge"
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", maxWidth: `${size}px`, margin: "0 auto" }}
    >
      <svg
        viewBox={`0 0 ${size} ${cy + 4}`}
        width="100%"
        aria-hidden="true"
        style={{ display: "block", overflow: "visible" }}
      >
        <title>{ariaLabel}</title>

        {/* Track (background arc) */}
        {trackPath && (
          <path
            d={trackPath}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Fill arc */}
        {fillArcPath && fraction > 0 && (
          <path
            d={fillArcPath}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Score number — centered */}
        <text
          x={cx}
          y={cy - strokeWidth * 0.15}
          textAnchor="middle"
          dominantBaseline="auto"
          className="score-gauge__value"
          style={{
            fill: hasValue ? fillColor : "var(--muted)",
            fontSize: `${size * 0.22}px`,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {displayValue}
        </text>

        {/* Label below number */}
        <text
          x={cx}
          y={cy + strokeWidth * 0.5}
          textAnchor="middle"
          dominantBaseline="hanging"
          style={{
            fill: "var(--muted)",
            fontSize: `${size * 0.09}px`,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
