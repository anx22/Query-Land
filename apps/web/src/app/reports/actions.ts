"use server";

import { revalidatePath } from "next/cache";
import { friendlyActionError } from "../../lib/action-errors";
import { redirect } from "next/navigation";
import {
  createAlertRule,
  createReportSchedule,
  deleteAlertRule,
  deliverReport,
  evaluateAlerts,
  generateReport,
  runDueSchedules,
} from "../../features/reports";

export async function generateReportAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const type = requiredString(formData, "type") as Parameters<typeof generateReport>[1];
    await generateReport(projectId, type);
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  redirect("/reports?generated=1");
}

export async function deliverReportAction(formData: FormData) {
  let status = "sent";
  try {
    const reportId = requiredString(formData, "reportId");
    const channel = requiredString(formData, "channel") as Parameters<typeof deliverReport>[1];
    const target = formData.get("target");
    const delivery = await deliverReport(
      reportId,
      channel,
      typeof target === "string" && target.trim() ? target.trim() : undefined
    );
    status = delivery.status;
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  // Honest feedback: only report success when the channel actually delivered.
  // "skipped" (e.g. e-mail dispatch not configured) and "failed" must not look like a success.
  redirect(`/reports?delivered=${encodeURIComponent(status)}`);
}

export async function createScheduleAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const type = requiredString(formData, "type") as Parameters<typeof createReportSchedule>[1]["type"];
    const cadence = requiredString(formData, "cadence") as Parameters<typeof createReportSchedule>[1]["cadence"];
    const channelRaw = formData.get("channel");
    const targetRaw = formData.get("target");
    const channel = typeof channelRaw === "string" && channelRaw.trim() ? channelRaw.trim() : undefined;
    const target = typeof targetRaw === "string" && targetRaw.trim() ? targetRaw.trim() : undefined;
    // A channel without a recipient would record every run as "skipped" forever —
    // looks configured but never delivers. Require a recipient when a channel is chosen.
    if (channel && !target) {
      throw new Error("Bitte geben Sie einen Empfänger an (E-Mail-Adresse oder Webhook-URL).");
    }
    await createReportSchedule(projectId, {
      type,
      cadence,
      channel: channel as Parameters<typeof createReportSchedule>[1]["channel"],
      target,
    });
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  redirect("/reports?schedule=1");
}

export async function runDueAction(formData: FormData) {
  let result: { generated: number; reports: unknown[] };
  try {
    const projectId = requiredString(formData, "projectId");
    result = await runDueSchedules(projectId);
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  redirect(`/reports?due=${result.generated}`);
}

export async function createAlertRuleAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const metric = requiredString(formData, "metric");
    const comparator = requiredString(formData, "comparator");
    const thresholdRaw = requiredString(formData, "threshold");
    const threshold = Number(thresholdRaw);
    if (Number.isNaN(threshold)) {
      throw new Error("Schwellwert muss eine Zahl sein.");
    }
    await createAlertRule(projectId, { metric, comparator, threshold });
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  redirect("/reports?alertrule=1");
}

export async function deleteAlertRuleAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const ruleId = requiredString(formData, "ruleId");
    await deleteAlertRule(projectId, ruleId);
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  redirect("/reports?alertdeleted=1");
}

export async function evaluateAlertsAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    await evaluateAlerts(projectId);
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  redirect("/reports?evaluated=1");
}

function revalidateReportViews(): void {
  revalidatePath("/");
  revalidatePath("/reports");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function messageFor(error: unknown): string {
  return friendlyActionError(error, "Report-Aktion konnte nicht ausgeführt werden.");
}
