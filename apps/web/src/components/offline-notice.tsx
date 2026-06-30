/**
 * Friendly "backend unreachable" notice for end users.
 *
 * Never exposes the API base URL or raw technical error text — those belong in server logs, not in
 * front of a non-expert. Used everywhere a page would otherwise print "{errorMessage} · Erwartete
 * API: {apiBaseUrl}".
 */
export function OfflineNotice() {
  return (
    <p className="notice danger">
      Die Daten sind momentan nicht erreichbar. Bitte versuchen Sie es in wenigen Minuten erneut.
    </p>
  );
}
