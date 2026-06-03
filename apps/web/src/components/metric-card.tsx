export interface MetricCardProps {
  label: string;
  value: string;
  note?: string;
}

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <div className="card">
      <p className="kicker">{label}</p>
      <span className="metric-value">{value}</span>
      {note ? <p>{note}</p> : null}
    </div>
  );
}
