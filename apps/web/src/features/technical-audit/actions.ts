"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { drainCrawlJobs } from "../../lib/crawl-cron";
import { callInternalApi } from "../../lib/server-api";
import { computeCrawlHealthScore, dismissAuditIssue, reopenAuditIssue, resolveAuditIssue, scheduleCrawlSeedRun } from "./api";

export async function startCrawlAction(formData: FormData) {
  try {
    await scheduleCrawlSeedRun(requiredString(formData, "projectId"), requiredString(formData, "siteId"), requiredString(formData, "baseUrl"));
    // Process the just-queued crawl immediately. On the Hobby plan the cron only
    // runs daily, so without this the user would wait up to 24h for results.
    // Best-effort: if it times out, the job stays claimable (stale-reclaim) and
    // the scheduled worker picks it up later.
    await processQueuedCrawlInline();
  } catch (error) {
    redirect(`/technical-audit?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateTechnicalAuditViews();
  redirect("/technical-audit?started=1");
}

async function processQueuedCrawlInline(): Promise<void> {
  try {
    await drainCrawlJobs({ call: (method, path, body) => callInternalApi(method, path, body), maxJobs: 1 });
  } catch {
    // Swallow: the crawl is queued and the scheduled/stale-reclaim path is the backstop.
  }
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
