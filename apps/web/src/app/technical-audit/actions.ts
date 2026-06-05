"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeCrawlHealthScore, createCrawlRun, createFoundationJob, dismissAuditIssue, reopenAuditIssue, resolveAuditIssue } from "../../lib/foundation-api";

export async function startCrawlAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const siteId = requiredString(formData, "siteId");
    const baseUrl = requiredString(formData, "baseUrl");
    const crawlRun = await createCrawlRun(projectId, siteId, "manual");
    await createFoundationJob({
      projectId,
      type: "crawl_seed",
      subject: `${baseUrl}:run:${crawlRun.id}`,
      payload: { siteId, baseUrl, crawlRunId: crawlRun.id }
    });
  } catch (error) {
    redirect(`/technical-audit?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateTechnicalAuditViews();
  redirect("/technical-audit?started=1");
}

export async function computeHealthAction(formData: FormData) {
  try {
    await computeCrawlHealthScore(requiredString(formData, "projectId"), requiredString(formData, "siteId"));
  } catch (error) {
    redirect(`/technical-audit?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateTechnicalAuditViews();
  redirect("/technical-audit?health=1");
}

export async function resolveIssueAction(formData: FormData) {
  await updateIssueAction(formData, "resolve");
}

export async function dismissIssueAction(formData: FormData) {
  await updateIssueAction(formData, "dismiss");
}

export async function reopenIssueAction(formData: FormData) {
  await updateIssueAction(formData, "reopen");
}

async function updateIssueAction(formData: FormData, action: "resolve" | "dismiss" | "reopen") {
  try {
    const projectId = requiredString(formData, "projectId");
    const siteId = requiredString(formData, "siteId");
    const issueId = requiredString(formData, "issueId");
    if (action === "resolve") {
      await resolveAuditIssue(projectId, siteId, issueId);
    } else if (action === "dismiss") {
      await dismissAuditIssue(projectId, siteId, issueId);
    } else {
      await reopenAuditIssue(projectId, siteId, issueId);
    }
    await computeCrawlHealthScore(projectId, siteId);
  } catch (error) {
    redirect(`/technical-audit?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateTechnicalAuditViews();
  redirect(`/technical-audit?issue=${action}&issueStatus=${action === "reopen" ? "resolved" : "open"}`);
}

function revalidateTechnicalAuditViews(): void {
  revalidatePath("/");
  revalidatePath("/technical-audit");
  revalidatePath("/api/foundation");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Technical-Audit-Aktion konnte nicht gespeichert werden.";
}
