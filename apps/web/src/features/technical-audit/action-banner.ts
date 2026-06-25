/**
 * action-banner.ts — pure resolution of the Technical-Audit action-feedback
 * banner from searchParams. Server actions redirect back with `?error=<msg>`
 * (failure) or `?started=1` (a crawl was started); this maps those into a small,
 * presentational banner descriptor. No React / no "use client" → unit-testable.
 */

export type ActionBannerTone = "success" | "danger";

export interface ActionBanner {
  tone: ActionBannerTone;
  /** Decoded, human-readable message (German). */
  message: string;
  /** ARIA role: alert for errors, status for success. */
  role: "alert" | "status";
}

/**
 * Resolve the action banner from the relevant searchParams.
 * Error wins over a started flag. Returns null when nothing to show.
 */
export function resolveActionBanner(input: {
  error?: string;
  started?: string;
} = {}): ActionBanner | null {
  const error = typeof input.error === "string" ? input.error.trim() : "";
  if (error) {
    return { tone: "danger", message: error, role: "alert" };
  }
  if (input.started === "1") {
    return {
      tone: "success",
      message: "Crawl gestartet. Ergebnisse erscheinen, sobald der Lauf abgeschlossen ist.",
      role: "status",
    };
  }
  return null;
}
