"use client";

/**
 * AlertMetricChart — client island that visualises an alert metric vs. its threshold.
 *
 * Receives a fully-derived, serializable AlertChartModel as props (built server-side
 * by `buildAlertChartModel` in reports-logic.ts). It imports ONLY pure logic + chart
 * primitives — never the data loader or api-client — so it stays out of the Node bundle.
 *
 * - kind "gauge"  → ScoreGauge (0–100 score metric vs. threshold).
 * - kind "trend"  → TrendChart (observed value over evaluated events).
 * - kind "none"   → renders nothing (caller shows a factual list instead).
 *
 * Serious-Zone: numbers/threshold are factual, no metaphor.
 */

import { ScoreGauge } from "../../components/charts/score-gauge";
import { TrendChart, type TrendDataPoint } from "../../components/charts/trend-chart";
import { labelForComparator, labelForMetric, type AlertChartModel } from "./reports-logic";

export interface AlertMetricChartProps {
  model: AlertChartModel;
}

export function AlertMetricChart({ model }: AlertMetricChartProps) {
  if (model.kind === "none") return null;

  const metricLabel = labelForMetric(model.metric);
  const thresholdText =
    model.comparator !== null && model.threshold !== null
      ? `Schwelle ${labelForComparator(model.comparator)} ${model.threshold.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`
      : "keine Schwelle";

  if (model.kind === "gauge") {
    return (
      <div className="reports-alert-chart">
        <ScoreGauge value={model.observedValue} max={100} label={metricLabel} size={140} />
        <p className="reports-alert-chart__caption muted">{thresholdText}</p>
      </div>
    );
  }

  // kind === "trend"
  const data: TrendDataPoint[] = model.history.map((value, index) => ({
    label: model.historyLabels[index] ?? String(index + 1),
    value,
  }));

  const events =
    model.threshold !== null && data.length > 0
      ? [{ label: data[data.length - 1].label, description: thresholdText }]
      : [];

  return (
    <div className="reports-alert-chart">
      <TrendChart
        data={data}
        title={`${metricLabel} — Verlauf`}
        valueLabel={metricLabel}
        events={events}
        height={10}
        yMax="auto"
      />
      <p className="reports-alert-chart__caption muted">{thresholdText}</p>
    </div>
  );
}
