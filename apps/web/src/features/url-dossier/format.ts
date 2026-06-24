/**
 * Pure formatters for the URL Dossier. Kept side-effect-free + unit-tested.
 */

/** Formats an integer count with German thousands grouping. */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("de-DE");
}

/** Formats a 0–1 CTR fraction as a German percentage string. */
export function formatCtr(ctr: number): string {
  if (!Number.isFinite(ctr)) return "—";
  return `${(ctr * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

/** Formats an average ranking position (1 = top). */
export function formatPosition(position: number | null): string {
  if (position == null || !Number.isFinite(position) || position <= 0) return "—";
  return position.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

/** Formats an ISO timestamp as a compact German date-time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

/** Maps an audit-issue severity to a global status/badge variant. */
export function severityVariant(severity: string): "danger" | "warning" | "default" {
  switch (severity) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warning";
    default:
      return "default";
  }
}
