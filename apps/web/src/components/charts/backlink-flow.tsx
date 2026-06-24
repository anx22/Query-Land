"use client";

/**
 * BacklinkFlowChart — diverging bar chart of New vs. Lost links (UX-4 §H).
 *
 * Renders gained counts upward (semantic.gain) and lost counts downward
 * (semantic.loss) per category (Backlinks / Verweisende Domains). Source data
 * is the latest backlink diff; the server owns loading and passes plain
 * serialisable FlowBar[] props — no fetch happens here.
 *
 * NOTE: the diff endpoint only exposes the latest snapshot-pair (no time
 * series), so this is a category-diverging bar rather than a time-diverging
 * bar. This is the honest representation of the available data.
 *
 * Serious-Zone (Teil 1 §1): numbers/axes/tooltip are factual; colors are
 * functional (gain/loss), never brand-orange.
 * A11y: role="img" + aria-label + SVG <title>.
 * Reduced-motion: matchMedia override on isAnimationActive.
 */

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTheme, ANIMATION_DEFAULT, animationDuration } from "./chart-theme";

export interface FlowBar {
  label: string;
  gained: number;
  lost: number;
}

export interface BacklinkFlowChartProps {
  data: FlowBar[];
  /** Accessible chart title. */
  title?: string;
  /** Chart wrapper height in rem (default 14). */
  height?: number;
}

interface FlowDatum {
  label: string;
  gained: number;
  /** Stored as a negative number so the bar renders downward. */
  lostNeg: number;
  lost: number;
}

function toDatum(bar: FlowBar): FlowDatum {
  return { label: bar.label, gained: bar.gained, lost: bar.lost, lostNeg: -bar.lost };
}

function FlowEmpty({ title }: { title: string }) {
  return (
    <div
      className="backlinks-flow-empty"
      role="img"
      aria-label={`${title} — keine Daten vorhanden`}
    >
      <strong className="backlinks-flow-empty__title">Noch kein Vergleich möglich</strong>
      <span className="backlinks-flow-empty__hint">
        Zu- und Abgänge erscheinen, sobald mindestens zwei Snapshots vorliegen.
      </span>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: FlowDatum }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="backlinks-chart-tooltip">
      <div className="backlinks-chart-tooltip__date">{label}</div>
      <div className="backlinks-chart-tooltip__row">
        <span className="backlinks-chart-tooltip__label">Neu:</span>
        <span className="backlinks-chart-tooltip__value">+{datum.gained.toLocaleString("de-DE")}</span>
      </div>
      <div className="backlinks-chart-tooltip__row">
        <span className="backlinks-chart-tooltip__label">Verloren:</span>
        <span className="backlinks-chart-tooltip__value">−{datum.lost.toLocaleString("de-DE")}</span>
      </div>
    </div>
  );
}

export function BacklinkFlowChart({
  data,
  title = "Zu- und Abgänge",
  height = 14,
}: BacklinkFlowChartProps) {
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
    return <FlowEmpty title={title} />;
  }

  const chartData = data.map(toDatum);
  const maxMagnitude = Math.max(
    1,
    ...chartData.map((d) => Math.max(d.gained, d.lost))
  );
  const domainBound = Math.ceil(maxMagnitude * 1.2);

  return (
    <div style={{ width: "100%", height: `${height}rem` }} role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }} barCategoryGap="28%">
          <title>{title}</title>

          <CartesianGrid strokeDasharray="4 4" stroke={chartTheme.chrome.grid} vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize }}
            axisLine={{ stroke: chartTheme.chrome.grid }}
            tickLine={false}
            interval={0}
          />

          <YAxis
            domain={[-domainBound, domainBound]}
            allowDecimals={false}
            tick={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => String(Math.abs(Math.round(v)))}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-muted)", radius: 4 }} />

          <ReferenceLine y={0} stroke={chartTheme.chrome.grid} />

          <Bar dataKey="gained" isAnimationActive={isAnimActive} animationDuration={animationDuration} radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={`gain-${entry.label}`} fill={chartTheme.semantic.gain} />
            ))}
            <LabelList
              dataKey="gained"
              position="top"
              style={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize, fontWeight: 700 }}
              formatter={(value) => {
                const v = Number(value);
                return v > 0 ? `+${v.toLocaleString("de-DE")}` : "";
              }}
            />
          </Bar>

          <Bar dataKey="lostNeg" isAnimationActive={isAnimActive} animationDuration={animationDuration} radius={[0, 0, 4, 4]}>
            {chartData.map((entry) => (
              <Cell key={`loss-${entry.label}`} fill={chartTheme.semantic.loss} />
            ))}
            <LabelList
              dataKey="lost"
              position="bottom"
              style={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize, fontWeight: 700 }}
              formatter={(value) => {
                const v = Number(value);
                return v > 0 ? `−${v.toLocaleString("de-DE")}` : "";
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
