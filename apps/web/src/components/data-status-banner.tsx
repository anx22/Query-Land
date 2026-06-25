/**
 * data-status-banner.tsx — honest "is this real data?" signal per module.
 *
 * Rendered once centrally in AppShell from the active route's `dataStatus`, so
 * demo/placeholder modules are clearly labeled instead of silently faking data.
 * Live modules render nothing.
 */

import type { ModuleDataStatus } from "../app/module-routes";

export interface DataStatusBannerProps {
  status: ModuleDataStatus;
  /** Optional override sentence for nuanced modules. */
  note?: string;
}

export function DataStatusBanner({ status, note }: DataStatusBannerProps) {
  if (status === "live") return null;

  if (status === "coming-soon") {
    return (
      <p className="notice warning data-status-banner" role="status">
        <strong>In Arbeit · Coming soon.</strong> Dieses Modul ist noch nicht aktiv.
      </p>
    );
  }

  return (
    <p className="notice warning data-status-banner" role="status">
      <strong>Demo-Daten.</strong>{" "}
      {note ?? "Die Werte auf dieser Seite sind Platzhalter — echte Datenquelle folgt."}
    </p>
  );
}
