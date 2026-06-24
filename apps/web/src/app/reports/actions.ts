"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAlertRule,
  createReportSchedule,
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
  try {
    const reportId = requiredString(formData, "reportId");
    const channel = requiredString(formData, "channel") as Parameters<typeof deliverReport>[1];
    const target = formData.get("target");
    await deliverReport(reportId, channel, typeof target === "string" && target.trim() ? target.trim() : undefined);
  } catch (error) {
    redirect(`/reports?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateReportViews();
  redirect("/reports?delivered=1");
}

export async function createScheduleAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const type = requiredString(formData, "type") as Parameters<typeof createReportSchedule>[1]["type"];
    const cadence = requiredString(formData, "cadence") as Parameters<typeof createReportSchedule>[1]["cadence"];
    const channel = formData.get("channel");
    const target = formData.get("target");
    await createReportSchedule(projectId, {
      type,
      cadence,
      channel: typeof channel === "string" && channel.trim() ? (channel.trim() as Parameters<typeof createReportSchedule>[1]["channel"]) : undefined,
      target: typeof target === "string" && target.trim() ? target.trim() : undefined,
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
  return error instanceof Error ? error.message : "Report-Aktion konnte nicht ausgeführt werden.";
}
