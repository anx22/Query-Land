"use client";

/**
 * VisibilitySpikeChart — UX-0 Chart-Lib-Spike proof island.
 *
 * Renders a Recharts AreaChart with server-supplied data passed as plain props.
 * No data fetching happens in this component; the server component (spike/page.tsx)
 * owns all data loading and passes a serialisable array here.
 *
 * SSR/Hydration notes:
 *   - The `"use client"` directive keeps Recharts (DOM-measuring, ESM) out of the
 *     server bundle entirely. Next.js 15 renders a static placeholder on the server
 *     and hydrates the chart in the browser.
 *   - ResponsiveContainer requires a numeric height (not "100%") to avoid an infinite
 *     resize loop on the initial render. We supply it via the wrapper div's height.
 *
 * prefers-reduced-motion:
 *   isAnimationActive="auto" (Recharts 3 default) already respects the media query.
 *   We additionally read the preference via `useEffect`/`matchMedia` so that the flag
 *   is available without a re-render penalty, and pass it explicitly to be safe.
 *
 * Responsive:
 *   At ≤ 980 px the chart container collapses to full-width via the global `.card` grid;
 *   ResponsiveContainer handles internal resizing automatically.
 */

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { chartTheme, ANIMATION_DEFAULT, animationDuration } from "./chart-theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VisibilityDataPoint {
  /** Human-readable label shown on the X axis (e.g. "15. Mai" / ISO date). */
  label: string;
  /** Numeric value plotted on the Y axis (e.g. total backlinks or referring domains). */
  value: number;
}

export interface VisibilitySpikeChartProps {
  data: VisibilityDataPoint[];
  /**
   * Accessible chart title rendered as an SVG <title> and aria-label.
   * @default "Backlink-Verlauf"
   */
  title?: string;
  /**
   * Y-axis label for the tooltip (e.g. "Backlinks").
   * @default "Wert"
   */
  valueLabel?: string;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ title }: { title: string }) {
  return (
    <div
      role="img"
      aria-label={`${title} — keine Daten vorhanden`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        minHeight: "14rem",
        border: `1px dashed ${chartTheme.chrome.grid}`,
        borderRadius: "1rem",
        color: chartTheme.chrome.axisText,
        fontSize: "0.9rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      {/* Land-metapher is allowed in empty states per spec Teil 1 §1 */}
      <span style={{ fontSize: "2rem", lineHeight: 1 }}>&#x1F5FA;&#xFE0F;</span>
      <strong style={{ color: "var(--ink)", fontSize: "1rem" }}>
        Noch keine Verlaufsdaten vorhanden
      </strong>
      <span>
        Starten Sie einen Backlink-Import, um den ersten Snapshot zu erstellen.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip content — .card style per spec Teil 2 §2.3
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
    <div
      style={{
        background: chartTheme.chrome.tooltipBackground,
        border: `1px solid ${chartTheme.chrome.tooltipBorder}`,
        borderRadius: chartTheme.chrome.tooltipBorderRadius,
        boxShadow: chartTheme.chrome.tooltipShadow,
        color: chartTheme.chrome.tooltipText,
        padding: "0.6rem 0.9rem",
        fontSize: "0.85rem",
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "0.2rem" }}>{label}</div>
      <div>
        <span style={{ color: chartTheme.chrome.axisText }}>{valueLabel}: </span>
        <span style={{ fontWeight: 700 }}>
          {typeof payload[0]?.value === "number"
            ? payload[0].value.toLocaleString("de-DE")
            : "—"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart island
// ---------------------------------------------------------------------------

export function VisibilitySpikeChart({
  data,
  title = "Backlink-Verlauf",
  valueLabel = "Wert",
}: VisibilitySpikeChartProps) {
  // Detect prefers-reduced-motion on the client only (avoids SSR mismatch).
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isAnimationActive: boolean | "auto" = reducedMotion ? false : ANIMATION_DEFAULT;

  if (data.length === 0) {
    return <EmptyState title={title} />;
  }

  return (
    /*
     * Wrapper div gives ResponsiveContainer a concrete pixel height.
     * ResponsiveContainer must NOT have height="100%" on a parent with
     * no explicit height — that causes an infinite resize loop in v3.
     */
    <div
      style={{ width: "100%", height: "14rem" }}
      role="img"
      aria-label={title}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          aria-label={title}
        >
          {/* Accessible SVG title for screen readers */}
          <title>{title}</title>

          <CartesianGrid
            strokeDasharray="4 4"
            stroke={chartTheme.chrome.grid}
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={{
              fill: chartTheme.chrome.axisText,
              fontSize: chartTheme.chrome.axisFontSize,
            }}
            axisLine={{ stroke: chartTheme.chrome.grid }}
            tickLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{
              fill: chartTheme.chrome.axisText,
              fontSize: chartTheme.chrome.axisFontSize,
            }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => v.toLocaleString("de-DE")}
          />

          <Tooltip
            content={<CustomTooltip valueLabel={valueLabel} />}
            cursor={{ stroke: chartTheme.chrome.grid, strokeWidth: 1 }}
          />

          {/*
           * Area for the own-domain series — brand-orange per spec §2.2.
           * fill and stroke use CSS vars; Recharts 3 passes them directly to SVG.
           */}
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
            isAnimationActive={isAnimationActive}
            animationDuration={animationDuration}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
