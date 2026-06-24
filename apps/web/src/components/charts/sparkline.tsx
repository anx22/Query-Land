"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { ANIMATION_DEFAULT, animationDuration, series } from "./chart-theme";

/**
 * Sparkline (spec §3.3) — a compact inline trend line without axes/grid.
 * Shared primitive reused by Overview, URL-Dossier and the Opportunity table.
 * Server data is passed as a plain number[] (no fetch in the client island).
 */
export interface SparklineProps {
  /** Ordered values (oldest → newest). Empty renders a neutral placeholder. */
  data: number[];
  /** Line color; defaults to the own-series brand token. */
  color?: string;
  /** Pixel height of the sparkline. */
  height?: number;
  /** Accessible description of what the trend represents. */
  ariaLabel?: string;
}

export function Sparkline({ data, color = series.own, height = 36, ariaLabel = "Trend" }: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <span aria-label="Keine Daten" style={{ color: "var(--muted)" }}>
        —
      </span>
    );
  }

  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ width: "100%", height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={ANIMATION_DEFAULT}
            animationDuration={animationDuration}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
