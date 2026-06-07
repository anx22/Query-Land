"use client";

/**
 * PriorityMatrix (spec §4.4) — Impact×Effort 2×2 bubble chart (Recharts ScatterChart).
 *
 * Chancen-Triage: Quick Wins / Big Bets / Filler / Vermeiden.
 *   x = effort          (1–5, "Aufwand")
 *   y = expectedImpact  (1–5, "Wirkung")
 *   size = businessValue
 *   color = type        (categorical scale, chartTheme.categorical)
 *
 * CI: four quadrant backgrounds (--surface-muted) via ReferenceArea, quadrant
 * labels in --muted, axis titles „Aufwand" / „Wirkung". Bubble hover → tooltip
 * (title + priority + ConfidenceBadge); click → Evidence-Chain-Drawer (handled
 * by the parent through onSelect). Selected bubble gets a --primary highlight ring.
 *
 * Serious-Zone: ja (reine Daten). A11y: role="img" + aria-label + <title>.
 * Reduced-motion: matchMedia pattern (mirrors PositionDistribution).
 * Empty-state: when there are no plottable bubbles.
 *
 * This is a NEW chart file (unique filename) owned by UX-5; it does not modify
 * any existing chart component.
 */

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { chartTheme, ANIMATION_DEFAULT, animationDuration } from "./chart-theme";
import { ConfidenceBadge, type ConfidenceLevel } from "../confidence-badge";

// ---------------------------------------------------------------------------
// Plain, serialisable bubble shape (built server-side, passed to the island)
// ---------------------------------------------------------------------------

export interface PriorityBubble {
  id: string;
  title: string;
  effort: number;
  expectedImpact: number;
  businessValue: number;
  priority: number;
  confidenceLevel: ConfidenceLevel;
  /** chartTheme.categorical key for the colour */
  colorKey: keyof typeof chartTheme.categorical;
  typeLabel: string;
}

export interface PriorityMatrixProps {
  bubbles: PriorityBubble[];
  /** id of the currently selected bubble (drawer open) — gets a highlight ring */
  selectedId?: string | null;
  /** Click handler → opens the Evidence-Chain-Drawer in the parent island */
  onSelect?: (id: string) => void;
  /** Accessible title */
  title?: string;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function PriorityMatrixEmpty({ title }: { title: string }) {
  return (
    <div className="board-matrix-empty" role="img" aria-label={`${title} — keine Daten vorhanden`}>
      <strong className="board-matrix-empty__title">Noch keine Chancen zum Priorisieren</strong>
      <span className="board-matrix-empty__hint">
        Sobald Opportunities mit Aufwand und Wirkung vorliegen, erscheinen sie hier als Impact×Effort-Matrix.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip — title + priority + ConfidenceBadge
// ---------------------------------------------------------------------------

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PriorityBubble }>;
}

function MatrixTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const bubble = payload[0]?.payload;
  if (!bubble) return null;
  return (
    <div className="board-matrix-tooltip">
      <div className="board-matrix-tooltip__title">{bubble.title}</div>
      <div className="board-matrix-tooltip__meta">
        <span className="board-matrix-tooltip__type">{bubble.typeLabel}</span>
        <span className="board-matrix-tooltip__prio">Priorität {bubble.priority}</span>
      </div>
      <div className="board-matrix-tooltip__row">
        Wirkung {bubble.expectedImpact} · Aufwand {bubble.effort}
      </div>
      <ConfidenceBadge level={bubble.confidenceLevel} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Axis title labels
// ---------------------------------------------------------------------------

const QUADRANT_LABEL_STYLE: React.CSSProperties = {
  fill: chartTheme.chrome.axisText,
  fontSize: "0.7rem",
  fontWeight: 600,
};

// ---------------------------------------------------------------------------
// Chart island
// ---------------------------------------------------------------------------

export function PriorityMatrix({
  bubbles,
  selectedId = null,
  onSelect,
  title = "Impact×Effort-Matrix",
}: PriorityMatrixProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isAnimActive: boolean | "auto" = reducedMotion ? false : ANIMATION_DEFAULT;

  const plottable = bubbles.filter(
    (b) => Number.isFinite(b.effort) && Number.isFinite(b.expectedImpact)
  );

  if (plottable.length === 0) {
    return <PriorityMatrixEmpty title={title} />;
  }

  const maxBusinessValue = Math.max(...plottable.map((b) => b.businessValue), 1);

  return (
    <div className="board-matrix" role="img" aria-label={title} style={{ width: "100%", height: "22rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 36, left: 8 }}>
          <title>{title}</title>

          {/* Four quadrant backgrounds (midpoint at 3 on the 1–5 scale). */}
          <ReferenceArea x1={0.5} x2={3} y1={3} y2={5.5} fill="var(--surface-muted)" fillOpacity={0.7} stroke="none" />
          <ReferenceArea x1={3} x2={5.5} y1={3} y2={5.5} fill="var(--surface-muted)" fillOpacity={0.35} stroke="none" />
          <ReferenceArea x1={0.5} x2={3} y1={0.5} y2={3} fill="var(--surface-muted)" fillOpacity={0.35} stroke="none" />
          <ReferenceArea x1={3} x2={5.5} y1={0.5} y2={3} fill="var(--surface-muted)" fillOpacity={0.7} stroke="none" />

          {/* Quadrant labels in --muted. */}
          <ReferenceArea
            x1={0.5}
            x2={3}
            y1={3}
            y2={5.5}
            fill="none"
            stroke="none"
            label={{ value: "Quick Wins", position: "insideTopLeft", style: QUADRANT_LABEL_STYLE }}
          />
          <ReferenceArea
            x1={3}
            x2={5.5}
            y1={3}
            y2={5.5}
            fill="none"
            stroke="none"
            label={{ value: "Big Bets", position: "insideTopRight", style: QUADRANT_LABEL_STYLE }}
          />
          <ReferenceArea
            x1={0.5}
            x2={3}
            y1={0.5}
            y2={3}
            fill="none"
            stroke="none"
            label={{ value: "Filler", position: "insideBottomLeft", style: QUADRANT_LABEL_STYLE }}
          />
          <ReferenceArea
            x1={3}
            x2={5.5}
            y1={0.5}
            y2={3}
            fill="none"
            stroke="none"
            label={{ value: "Vermeiden", position: "insideBottomRight", style: QUADRANT_LABEL_STYLE }}
          />

          <CartesianGrid strokeDasharray="4 4" stroke={chartTheme.chrome.grid} />

          <XAxis
            type="number"
            dataKey="effort"
            name="Aufwand"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize }}
            axisLine={{ stroke: chartTheme.chrome.grid }}
            tickLine={false}
            label={{ value: "Aufwand", position: "bottom", offset: 12, fill: chartTheme.chrome.axisText, fontSize: "0.75rem" }}
          />
          <YAxis
            type="number"
            dataKey="expectedImpact"
            name="Wirkung"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: chartTheme.chrome.axisText, fontSize: chartTheme.chrome.axisFontSize }}
            axisLine={{ stroke: chartTheme.chrome.grid }}
            tickLine={false}
            width={40}
            label={{ value: "Wirkung", angle: -90, position: "insideLeft", offset: 16, fill: chartTheme.chrome.axisText, fontSize: "0.75rem" }}
          />
          <ZAxis type="number" dataKey="businessValue" range={[120, 900]} domain={[0, maxBusinessValue]} name="Business Value" />

          <Tooltip content={<MatrixTooltip />} cursor={{ strokeDasharray: "3 3", stroke: chartTheme.chrome.grid }} />

          <Scatter
            data={plottable}
            isAnimationActive={isAnimActive}
            animationDuration={animationDuration}
            onClick={(entry: unknown) => {
              const bubble = (entry as { payload?: PriorityBubble } | undefined)?.payload;
              if (bubble && onSelect) onSelect(bubble.id);
            }}
            cursor={onSelect ? "pointer" : undefined}
          >
            {plottable.map((bubble) => {
              const isSelected = bubble.id === selectedId;
              return (
                <Cell
                  key={bubble.id}
                  fill={chartTheme.categorical[bubble.colorKey]}
                  fillOpacity={0.78}
                  stroke={isSelected ? "var(--primary)" : "var(--surface)"}
                  strokeWidth={isSelected ? 3 : 1}
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
