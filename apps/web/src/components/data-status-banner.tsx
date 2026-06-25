/**
 * data-status-banner.tsx — honest "is this real data?" signal per module.
 *
 * Rendered once centrally in AppShell from the active route's `dataStatus`. The app no longer ships
 * demo/placeholder data, so live modules render nothing; only a not-yet-active module shows a note.
 */

import type { ModuleDataStatus } from "../app/module-routes";

export interface DataStatusBannerProps {
  status: ModuleDataStatus;
}

export function DataStatusBanner({ status }: DataStatusBannerProps) {
  if (status !== "coming-soon") return null;

  return (
    <p className="notice warning data-status-banner" role="status">
      <strong>In Arbeit · Coming soon.</strong> Dieses Modul ist noch nicht aktiv.
    </p>
  );
}
