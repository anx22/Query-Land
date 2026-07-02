"use client";

/**
 * IndexabilityFunnel — funnel of URL lifecycle stages (UX-6, spec §4.5).
 *
 *   Entdeckt → Gecrawlt → Indexierbar → Indexiert
 *
 * Rendered as a sequence of horizontal proportional bars (SVG-free, CSS-based)
 * driven by the sequential color scale. Per-stage drop is shown as a DeltaChip
 * in --danger. Stages whose value is null render an honest empty marker ("—")
 * rather than a fabricated number ("Indexiert" fills from the GSC URL-inspection sync).
 *
 * Serious-Zone: factual labels, functional colors, no metaphor.
 * A11y: role="img" + aria-label summary; each row has readable text.
 * Reduced-motion: bar width transition gated via prefers-reduced-motion in CSS.
 * Empty-state: when every stage value is null.
 *
 * Props:
 *   stages — FunnelStage[] from audit-api (plain/serialisable).
 *   title  — accessible title.
 */

import { chartTheme } from "./chart-theme";
import { DeltaChip } from "../delta-chip";
import type { FunnelStage } from "../../lib/audit-api";

export interface IndexabilityFunnelProps {
  stages: FunnelStage[];
  title?: string;
}

const STAGE_COLOR: Record<FunnelStage["key"], string> = {
  discovered: chartTheme.sequential.top3,
  fetched: chartTheme.sequential.top10,
  indexable: chartTheme.sequential.strikingDist,
  indexed: chartTheme.sequential.mid,
};

export function IndexabilityFunnel({
  stages,
  title = "Indexierbarkeits-Funnel",
}: IndexabilityFunnelProps) {
  const known = stages.filter((s) => s.value !== null) as Array<FunnelStage & { value: number }>;
  const isEmpty = known.length === 0;

  if (isEmpty) {
    return (
      <div className="audit-funnel-empty" role="img" aria-label={`${title} — keine Daten vorhanden`}>
        <strong className="audit-funnel-empty__title">Noch keine Analyse ausgewertet</strong>
        <span className="audit-funnel-empty__hint">
          Starten Sie eine Analyse, um zu sehen, wo URLs auf dem Weg in den Index verloren gehen.
        </span>
      </div>
    );
  }

  // Width is relative to the largest known stage value (the top of the funnel).
  const maxValue = Math.max(...known.map((s) => s.value), 1);

  const ariaLabel = `${title}: ${known
    .map((s) => `${s.label} ${s.value.toLocaleString("de-DE")}`)
    .join(", ")}`;

  return (
    <div className="audit-funnel" role="img" aria-label={ariaLabel}>
      {stages.map((stage) => {
        const value = stage.value;
        const hasValue = value !== null;
        const widthPct = hasValue ? Math.max(4, (value / maxValue) * 100) : 0;
        return (
          <div className="audit-funnel__row" key={stage.key}>
            <div className="audit-funnel__head">
              <span className="audit-funnel__label">{stage.label}</span>
              <span className="audit-funnel__value">
                {hasValue ? value.toLocaleString("de-DE") : "—"}
              </span>
              {stage.drop !== null ? <DeltaChip value={stage.drop} unit=" URLs" /> : null}
            </div>
            <div className="audit-funnel__track" aria-hidden="true">
              {hasValue ? (
                <div
                  className="audit-funnel__bar"
                  style={{ width: `${widthPct}%`, background: STAGE_COLOR[stage.key] }}
                />
              ) : (
                <span className="audit-funnel__missing">
                  noch nicht geprüft
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
