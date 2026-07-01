"use client";

/**
 * TrendChart — annotated trend AreaChart for the Overview hero (UX-1).
 *
 * Renders a Recharts AreaChart with server-supplied data points as plain props.
 * No data fetching happens in this component; the server component owns all loading
 * and passes a serialisable array + optional event markers here.
 *
 * Serious-Zone (Teil 1 §1): numbers/axes/tooltip are factual — no metaphor.
 * Reduced-motion: isAnimationActive="auto" (Recharts 3 default) + matchMedia override.
 * Responsive: ResponsiveContainer with concrete wrapper height (avoids infinite-resize).
 * A11y: role="img" + aria-label + SVG <title>.
 *
 * Props:
 *   data         — TrendDataPoint[] — serialisable [{label, value}]
 *   title        — accessible chart title (default "Visibility-Verlauf")
 *   valueLabel   — tooltip value label (default "Visibility")
 *   events       — optional EventMarker[] for deploy / algorithm events
 *   height       — chart wrapper height in rem (default 14)
 */

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { chartTheme, ANIMATION_DEFAULT, animationDuration } from "./chart-theme";
import { Icon } from "../icon";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendDataPoint {
  /** Human-readable X-axis label (e.g. "15.5." formatted date). */
  label: string;
  /** Numeric Y value (e.g. visibility score 0–100). */
  value: number;
}

export interface EventMarker {
  /** X-axis label value to anchor the reference line */
  label: string;
  /** Short description shown next to the marker */
  description: string;
}

export interface TrendChartProps {
  data: TrendDataPoint[];
  /**
   * Accessible chart title (role="img" aria-label + SVG <title>).
   * @default "Visibility-Verlauf"
   */
  title?: string;
  /**
   * Tooltip value label (shown next to the number).
   * @default "Visibility"
   */
  valueLabel?: string;
  /**
   * Optional vertical reference lines for deploy or algorithm events.
   */
  events?: EventMarker[];
  /**
   * Chart wrapper height in rem (default 14).
   */
  height?: number;
  /**
   * Upper bound of the Y axis. Default 100 (suits a 0–100 index like Visibility).
   * Pass "auto" for unbounded series (e.g. raw backlink counts) so values > 100
   * are not clipped; the axis then scales to the data maximum.
   * @default 100
   */
  yMax?: number | "auto";
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function TrendChartEmpty({ title }: { title: string }) {
  return (
    <div
      className="overview-trend-empty"
      role="img"
      aria-label={`${title} — keine Daten vorhanden`}
    >
      <span className="overview-trend-empty__glyph" aria-hidden="true">
        <Icon name="description" />
      </span>
      <strong className="overview-trend-empty__title">
        Noch keine Verlaufsdaten vorhanden
      </strong>
      <span className="overview-trend-empty__hint">
        Sobald Keywords getrackt und Sichtbarkeitswerte berechnet wurden, erscheint hier der Verlauf.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip — .card style per spec Teil 2 §2.3
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  valueLabel: string;
}

function CustomTooltip({ active, payload, label, valueLabel }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="overview-chart-tooltip">
      <div className="overview-chart-tooltip__date">{label}</div>
      <div className="overview-chart-tooltip__row">
        <span className="overview-chart-tooltip__label">{valueLabel}:</span>
        <span className="overview-chart-tooltip__value">
          {typeof payload[0]?.value === "number"
            ? payload[0].value.toLocaleString("de-DE", { maximumFractionDigits: 1 })
            : "—"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart island
// ---------------------------------------------------------------------------

export function TrendChart({
  data,
  title = "Visibility-Verlauf",
  valueLabel = "Visibility",
  events = [],
  height = 14,
  yMax = 100,
}: TrendChartProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isAnimActive: boolean | "auto" = reducedMotion ? false : ANIMATION_DEFAULT;

  if (!data || data.length === 0) {
    return <TrendChartEmpty title={title} />;
  }

  return (
    <div
      style={{ width: "100%", height: `${height}rem` }}
      role="img"
      aria-label={title}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <title>{title}</title>

          <CartesianGrid
            strokeDasharray="4 4"
            stroke={chartTheme.chrome.grid}
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize }}
            axisLine={{ stroke: chartTheme.chrome.grid }}
            tickLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, yMax === "auto" ? "dataMax" : yMax]}
            tick={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => String(Math.round(v))}
          />

          <Tooltip
            content={<CustomTooltip valueLabel={valueLabel} />}
            cursor={{ stroke: chartTheme.chrome.grid, strokeWidth: 1 }}
          />

          {/* Event markers (deploy / algorithm) */}
          {events.map((ev) => (
            <ReferenceLine
              key={ev.label}
              x={ev.label}
              stroke="var(--ink)"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: ev.description,
                fill: "var(--muted)",
                fontSize: "0.65rem",
                position: "top",
              }}
            />
          ))}

          <Area
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke={chartTheme.area.stroke}
            strokeWidth={2}
            fill={chartTheme.area.fill}
            fillOpacity={chartTheme.area.fillOpacity}
            dot={false}
            activeDot={{
              r: 4,
              stroke: chartTheme.area.stroke,
              strokeWidth: 2,
              fill: "var(--surface)",
            }}
            isAnimationActive={isAnimActive}
            animationDuration={animationDuration}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
