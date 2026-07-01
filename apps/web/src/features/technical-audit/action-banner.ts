/**
 * action-banner.ts — pure resolution of the Technical-Audit action-feedback
 * banner from searchParams. Server actions redirect back with `?error=<msg>`
 * (failure) or `?started=1` (a crawl was started); this maps those into a small,
 * presentational banner descriptor. No React / no "use client" → unit-testable.
 */

export type ActionBannerTone = "success" | "danger" | "warning";

export interface ActionBanner {
  tone: ActionBannerTone;
  /** Decoded, human-readable message (German). */
  message: string;
  /** ARIA role: alert for errors/warnings, status for success. */
  role: "alert" | "status";
}

/**
 * Resolve the action banner from the relevant searchParams.
 * Precedence: hard error > crawl-start-with-warning > plain started. Null = nothing.
 */
export function resolveActionBanner(input: {
  error?: string;
  started?: string;
  crawlWarning?: string;
} = {}): ActionBanner | null {
  const error = typeof input.error === "string" ? input.error.trim() : "";
  if (error) {
    return { tone: "danger", message: error, role: "alert" };
  }
  if (input.started === "1") {
    const warning = typeof input.crawlWarning === "string" ? input.crawlWarning.trim() : "";
    if (warning) {
      return {
        tone: "warning",
        message: `Analyse eingereiht, aber die Sofort-Verarbeitung meldete: ${warning} — der geplante Worker versucht es erneut.`,
        role: "alert",
      };
    }
    return {
      tone: "success",
      message: "Analyse gestartet. Ergebnisse erscheinen, sobald der Lauf abgeschlossen ist.",
      role: "status",
    };
  }
  return null;
}
