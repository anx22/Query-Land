"use client";

/**
 * SectionTreemap — website sections as tiles, sized by URL count and colored
 * by health/issue density (UX-6, spec §4.6). Uses Recharts <Treemap> (no visx
 * / no new dependency).
 *
 *   Tile size  = number of discovered URLs in the path segment.
 *   Tile color = functional health (green → amber → slate), NEVER brand-orange.
 *
 * Serious-Zone: factual labels, functional colors, no metaphor.
 * A11y: role="img" + aria-label summary; labels shown only above a min size.
 * Reduced-motion: animation disabled when prefers-reduced-motion is set.
 * Empty-state: when there are no sections.
 *
 * Props:
 *   sections — SectionGroup[] from audit-api (plain/serialisable).
 *   title    — accessible title.
 */

import { useEffect, useState } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { ANIMATION_DEFAULT, animationDuration } from "./chart-theme";
import type { SectionGroup } from "../../lib/audit-api";

export interface SectionTreemapProps {
  sections: SectionGroup[];
  title?: string;
}

/** Functional health → color (green/amber/slate). Mirrors gauge thresholds. */
export function healthColor(health: number): string {
  if (health >= 70) return "var(--success)";
  if (health >= 40) return "var(--warning)";
  return "var(--danger)";
}

interface TreemapDatum {
  name: string;
  size: number;
  health: number;
  issueCount: number;
  urlCount: number;
  fill: string;
}

export function sectionsToTreemapData(sections: SectionGroup[]): TreemapDatum[] {
  return sections.map((s) => ({
    name: s.path,
    size: Math.max(1, s.urlCount),
    health: s.health,
    issueCount: s.issueCount,
    urlCount: s.urlCount,
    fill: healthColor(s.health),
  }));
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
}

function TreemapTile({ x = 0, y = 0, width = 0, height = 0, name = "", fill }: TreemapContentProps) {
  const showLabel = width > 56 && height > 24;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="var(--surface)"
        strokeWidth={2}
        rx={4}
      />
      {showLabel ? (
        <text
          x={x + 6}
          y={y + 16}
          fill="#fff"
          fontSize={12}
          fontWeight={700}
          style={{ pointerEvents: "none" }}
        >
          {name}
        </text>
      ) : null}
    </g>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TreemapDatum }>;
}

function TreemapTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="audit-chart-tooltip">
      <div className="audit-chart-tooltip__title">{d.name}</div>
      <div className="audit-chart-tooltip__row">
        <span className="audit-chart-tooltip__label">URLs:</span>
        <span className="audit-chart-tooltip__value">{d.urlCount.toLocaleString("de-DE")}</span>
      </div>
      <div className="audit-chart-tooltip__row">
        <span className="audit-chart-tooltip__label">Offene Issues:</span>
        <span className="audit-chart-tooltip__value">{d.issueCount.toLocaleString("de-DE")}</span>
      </div>
      <div className="audit-chart-tooltip__row">
        <span className="audit-chart-tooltip__label">Health:</span>
        <span className="audit-chart-tooltip__value">{d.health}</span>
      </div>
    </div>
  );
}

export function SectionTreemap({ sections, title = "Section-Health" }: SectionTreemapProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (sections.length === 0) {
    return (
      <div className="audit-treemap-empty" role="img" aria-label={`${title} — keine Daten vorhanden`}>
        <strong className="audit-treemap-empty__title">Noch keine URLs entdeckt</strong>
        <span className="audit-treemap-empty__hint">
          Sobald ein Crawl URLs findet, erscheinen die Website-Bereiche hier als Kacheln.
        </span>
      </div>
    );
  }

  const isAnimActive: boolean | "auto" = reducedMotion ? false : ANIMATION_DEFAULT;
  const data = sectionsToTreemapData(sections);
  const ariaLabel = `${title}: ${data
    .slice(0, 8)
    .map((d) => `${d.name} ${d.urlCount} URLs, Health ${d.health}`)
    .join("; ")}`;

  return (
    <div style={{ width: "100%", height: "16rem" }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data as unknown as Array<Record<string, unknown>>}
          dataKey="size"
          nameKey="name"
          stroke="var(--surface)"
          isAnimationActive={isAnimActive}
          animationDuration={animationDuration}
          content={<TreemapTile />}
        >
          <Tooltip content={<TreemapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
