export interface InfoCardProps {
  label: string;
  value: string;
}

export function InfoCard({ label, value }: InfoCardProps) {
  return (
    <div className="card">
      <p className="kicker">{label}</p>
      <span className="metric-value">{value}</span>
    </div>
  );
}
