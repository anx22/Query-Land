"use server";

import { revalidatePath } from "next/cache";
import { friendlyActionError } from "../../lib/action-errors";
import { redirect } from "next/navigation";
import { drainCrawlJobs } from "../../lib/crawl-cron";
import { callInternalApi } from "../../lib/server-api";
import type { AuditIssueHistoryEntry } from "@seo-tool/domain-model";
import { computeCrawlHealthScore, dismissAuditIssue, loadAuditIssueHistory, reopenAuditIssue, resolveAuditIssue, scheduleCrawlSeedRun } from "./api";

export async function startCrawlAction(formData: FormData) {
  try {
    await scheduleCrawlSeedRun(requiredString(formData, "projectId"), requiredString(formData, "siteId"), requiredString(formData, "baseUrl"));
  } catch (error) {
    redirect(`/technical-audit?error=${encodeURIComponent(messageFor(error))}`);
  }

  // Process the just-queued crawl immediately. On the Hobby plan the cron only
  // runs daily, so without this the user would wait up to 24h for results. The
  // crawl is queued regardless; a processing problem is surfaced as a non-blocking
  // warning (NOT swallowed) so "0 results" is never silently mistaken for "healthy".
  const warning = await processQueuedCrawlInline();
  revalidateTechnicalAuditViews();
  redirect(warning ? `/technical-audit?started=1&crawlWarning=${encodeURIComponent(warning)}` : "/technical-audit?started=1");
}

/** Runs one inline crawl cycle; returns a warning message if it failed, else null. */
async function processQueuedCrawlInline(): Promise<string | null> {
  try {
    const result = await drainCrawlJobs({ call: (method, path, body) => callInternalApi(method, path, body), maxJobs: 1 });
    const failed = result.cycles.find((cycle) => cycle.errorMessage || cycle.status === "failed");
    if (failed) return failed.errorMessage ?? "Crawl-Verarbeitung ist fehlgeschlagen.";
    return null;
  } catch (error) {
    // The crawl stays queued (scheduled/stale-reclaim is the backstop); report the cause.
    return messageFor(error);
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
      await dismissAuditIssue(projectId, siteId, issueId, optionalString(formData, "reason"));
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

/** Server action: load an issue's lifecycle history for the detail drawer. */
export async function loadIssueHistoryAction(projectId: string, siteId: string, issueId: string): Promise<AuditIssueHistoryEntry[]> {
  try {
    return await loadAuditIssueHistory(projectId, siteId, issueId);
  } catch {
    // The drawer degrades gracefully to "no history" rather than crashing.
    return [];
  }
}

function revalidateTechnicalAuditViews(): void {
  revalidatePath("/");
  revalidatePath("/technical-audit");
  revalidatePath("/api/foundation");
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function messageFor(error: unknown): string {
  return friendlyActionError(error, "Technical-Audit-Aktion konnte nicht gespeichert werden.");
}
