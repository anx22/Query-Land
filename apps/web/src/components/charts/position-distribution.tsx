"use client";

/**
 * PositionDistribution — BarChart histogram of keyword position buckets (UX-1).
 *
 * Shows how keywords are distributed across the five ranking tiers:
 *   Top 3 · Top 4–10 · Striking Distance (11–20) · Mid (21–50) · Weak (51–100)
 *
 * Colors come from chartTheme.sequential — the sequential position scale.
 * "Striking Distance" is labeled as text (not via brand color) per spec §4.2.
 *
 * Serious-Zone: no metaphor; labels are factual.
 * A11y: role="img", aria-label, SVG <title>, bar values as text via custom label.
 * Reduced-motion: isAnimationActive pattern from TrendChart.
 * Empty-state: when all buckets are 0.
 *
 * Props:
 *   buckets  — PositionBuckets from overview-api
 *   title    — accessible title (default "Positions-Verteilung")
 */

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { chartTheme, ANIMATION_DEFAULT, animationDuration } from "./chart-theme";
import type { PositionBuckets } from "../../lib/overview-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PositionDistributionProps {
  buckets: PositionBuckets;
  /** Accessible title */
  title?: string;
}

// ---------------------------------------------------------------------------
// Data shaping
// ---------------------------------------------------------------------------

interface BucketBar {
  name: string;
  count: number;
  color: string;
  isStrikingDist: boolean;
}

export function bucketsToBarData(buckets: PositionBuckets): BucketBar[] {
  return [
    { name: "Top 1–3",          count: buckets.top3,        color: chartTheme.sequential.top3,        isStrikingDist: false },
    { name: "Top 4–10",         count: buckets.top10,       color: chartTheme.sequential.top10,       isStrikingDist: false },
    { name: "Striking\nDistance", count: buckets.strikingDist, color: chartTheme.sequential.strikingDist, isStrikingDist: true },
    { name: "Mitte 21–50",      count: buckets.mid,         color: chartTheme.sequential.mid,         isStrikingDist: false },
    { name: "Schwach 51–100",   count: buckets.weak,        color: chartTheme.sequential.weak,        isStrikingDist: false },
  ];
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function PositionDistributionEmpty({ title }: { title: string }) {
  return (
    <div
      className="overview-dist-empty"
      role="img"
      aria-label={`${title} — keine Daten vorhanden`}
    >
      <strong className="overview-dist-empty__title">
        Noch keine Rankings vorhanden
      </strong>
      <span className="overview-dist-empty__hint">
        Fügen Sie Keywords hinzu und starten Sie das Rank-Tracking, um die Positionsverteilung zu sehen.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: BucketBar }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;
  const name = entry.payload.name.replace("\n", " ");
  return (
    <div className="overview-chart-tooltip">
      <div className="overview-chart-tooltip__date">{name}</div>
      <div className="overview-chart-tooltip__row">
        <span className="overview-chart-tooltip__label">Keywords:</span>
        <span className="overview-chart-tooltip__value">
          {entry.value.toLocaleString("de-DE")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom X-axis tick that renders two-line labels for "Striking Distance"
// ---------------------------------------------------------------------------

interface CustomTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
}

function CustomXTick({ x = 0, y = 0, payload }: CustomTickProps) {
  if (!payload) return null;
  const lines = payload.value.split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={i * 14 + 12}
          textAnchor="middle"
          fill={chartTheme.chrome.axisText}
          fontSize={chartTheme.chrome.axisFontSize}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Chart island
// ---------------------------------------------------------------------------

export function PositionDistribution({
  buckets,
  title = "Positions-Verteilung",
}: PositionDistributionProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isAnimActive: boolean | "auto" = reducedMotion ? false : ANIMATION_DEFAULT;

  const isEmpty = buckets.total === 0;

  if (isEmpty) {
    return <PositionDistributionEmpty title={title} />;
  }

  const barData = bucketsToBarData(buckets);
  const maxCount = Math.max(...barData.map((b) => b.count), 1);

  return (
    <div
      style={{ width: "100%", height: "12rem" }}
      role="img"
      aria-label={title}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={barData}
          margin={{ top: 16, right: 8, bottom: 28, left: 0 }}
          barCategoryGap="20%"
        >
          <title>{title}</title>

          <CartesianGrid
            strokeDasharray="4 4"
            stroke={chartTheme.chrome.grid}
            vertical={false}
          />

          <XAxis
            dataKey="name"
            tick={<CustomXTick />}
            axisLine={{ stroke: chartTheme.chrome.grid }}
            tickLine={false}
            interval={0}
            height={42}
          />

          <YAxis
            allowDecimals={false}
            domain={[0, Math.ceil(maxCount * 1.2)]}
            tick={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize }}
            axisLine={false}
            tickLine={false}
            width={32}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "var(--surface-muted)", radius: 4 }}
          />

          <Bar
            dataKey="count"
            isAnimationActive={isAnimActive}
            animationDuration={animationDuration}
            radius={[4, 4, 0, 0]}
          >
            {barData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              style={{
                fill: chartTheme.chrome.axisText,
                fontSize: chartTheme.chrome.axisFontSize,
                fontWeight: 700,
              }}
              formatter={(value) => {
                const v = Number(value);
                return v > 0 ? v.toLocaleString("de-DE") : "";
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
