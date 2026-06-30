/**
 * Report delivery — the real send for a generated report.
 *
 * Two zero-to-low-setup channels:
 *   - "webhook": POST the report JSON to a user-supplied URL. No external provider, no secret.
 *   - "email":   send via Resend's REST API (https://api.resend.com/emails) using native fetch — no
 *                npm dependency, just RESEND_API_KEY + a sender. Falls back to an honest "skipped"
 *                when the key is absent (no fake "sent").
 *   - "slack" / unknown: no integration yet → honest "skipped".
 *
 * The HTTP call and the env config are injectable so tests exercise the real branches without
 * touching the network (mirrors the connector `fetchImpl` test-seam used elsewhere).
 */
import { reportToHtml, type Report } from "@seo-tool/domain-model";

export interface DeliveryResult {
  /** Persisted verbatim into report_deliveries.status — "sent" | "failed" | "skipped". */
  status: "sent" | "failed" | "skipped";
  /** Short, non-secret reason for logs/audit (never includes the API key). */
  detail?: string;
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;
interface DeliveryConfig {
  resendApiKey: string | null;
  from: string;
}

const realFetch: FetchImpl = (input, init) => globalThis.fetch(input, init);
const realConfig = (): DeliveryConfig => ({
  resendApiKey: process.env.RESEND_API_KEY?.trim() ? process.env.RESEND_API_KEY.trim() : null,
  from: process.env.REPORTS_FROM_EMAIL?.trim() ? process.env.REPORTS_FROM_EMAIL.trim() : "onboarding@resend.dev",
});

let fetchImpl: FetchImpl = realFetch;
let readConfig: () => DeliveryConfig = realConfig;

/** Test seam: inject a fake fetch and/or config so the email/webhook branches run without the network. */
export function __setReportDeliveryHooksForTests(hooks: { fetchImpl?: FetchImpl; readConfig?: () => DeliveryConfig }): void {
  if (hooks.fetchImpl) fetchImpl = hooks.fetchImpl;
  if (hooks.readConfig) readConfig = hooks.readConfig;
}

/** Test seam: restore the real fetch + env config. */
export function __resetReportDeliveryHooksForTests(): void {
  fetchImpl = realFetch;
  readConfig = realConfig;
}

/** Whether a real email provider is configured (used to surface honest UI state). */
export function emailDeliveryConfigured(): boolean {
  return readConfig().resendApiKey !== null;
}

export async function sendReportDelivery(
  channel: string,
  target: string | null | undefined,
  report: Report,
): Promise<DeliveryResult> {
  const cleanTarget = target && target.trim() !== "" ? target.trim() : null;
  if (!cleanTarget) {
    return { status: "skipped", detail: "no recipient configured" };
  }

  if (channel === "webhook") {
    try {
      const res = await fetchImpl(cleanTarget, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          projectId: report.projectId,
          type: report.type,
          title: report.title,
          generatedAt: report.generatedAt,
          sections: report.sections,
        }),
      });
      return res.ok ? { status: "sent" } : { status: "failed", detail: `webhook responded ${res.status}` };
    } catch {
      return { status: "failed", detail: "webhook request failed" };
    }
  }

  if (channel === "email") {
    const { resendApiKey, from } = readConfig();
    if (!resendApiKey) {
      return { status: "skipped", detail: "email provider not configured (set RESEND_API_KEY)" };
    }
    try {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({ from, to: cleanTarget, subject: report.title, html: reportToHtml(report) }),
      });
      return res.ok ? { status: "sent" } : { status: "failed", detail: `email provider responded ${res.status}` };
    } catch {
      return { status: "failed", detail: "email request failed" };
    }
  }

  // slack or any other channel: no integration wired yet — be honest, never fake "sent".
  return { status: "skipped", detail: `${channel} delivery not configured` };
}
