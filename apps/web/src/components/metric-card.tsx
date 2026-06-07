import type { ReactNode } from "react";
import { InfoTip } from "./info-tip";

export interface MetricCardProps {
  label: string;
  value: string;
  note?: string;
  /** Optional contextual help shown as an "i" InfoTip next to the label. */
  info?: ReactNode;
}

export function MetricCard({ label, value, note, info }: MetricCardProps) {
  return (
    <div className="card">
      <p className="kicker">
        {label}
        {info ? <InfoTip label={`${label} erklären`}>{info}</InfoTip> : null}
      </p>
      <span className="metric-value">{value}</span>
      {note ? <p>{note}</p> : null}
    </div>
  );
}
