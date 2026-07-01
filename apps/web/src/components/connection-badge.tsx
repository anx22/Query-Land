/**
 * ConnectionBadge — backend-liveness indicator for page heroes.
 *
 * Renders NOTHING while the data layer is reachable. A green "Daten verbunden" badge in
 * that state is not just noise — a non-expert reads it as "my data sources (Google Search
 * Console / Analytics) are connected", which is FALSE until they actually link one in the
 * settings. Showing it next to empty first-run screens directly contradicts the product's
 * "Sichtbarkeit, die sich belegen lässt" promise. So we only surface a status when something
 * is genuinely wrong (the backend is unreachable) — the badge can never imply a connection
 * the user has not made.
 */
export function ConnectionBadge({ connected }: { connected: boolean }) {
  if (connected) return null;
  return <span className="badge danger">Daten offline</span>;
}
