"use server";

import { revalidatePath } from "next/cache";
import { friendlyActionError } from "../../lib/action-errors";
import { redirect } from "next/navigation";
import type { OpportunityStatus } from "@seo-tool/domain-model";
import { generateAllOpportunities, revalidateOpportunity, syncSearchPerformance, transitionOpportunity } from "../../features/content-opportunities";

export async function transitionOpportunityAction(formData: FormData) {
  let status: OpportunityStatus;
  try {
    status = requiredString(formData, "status") as OpportunityStatus;
    await transitionOpportunity(requiredString(formData, "opportunityId"), status);
  } catch (error) {
    redirect(`/content-opportunities?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateOpportunityViews();
  redirect(`/content-opportunities?transition=${encodeURIComponent(status)}`);
}

/**
 * Bulk status transition for the board's Bulk-Action-Bar (spec §3.9 / §G).
 * Resilient: each opportunity is transitioned independently so a single invalid
 * transition (state machine reject) does not abort the rest. Returns a summary
 * the client surfaces as a transient message — no redirect, the island refreshes.
 */
export async function bulkTransitionOpportunitiesAction(
  ids: string[],
  status: OpportunityStatus
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await transitionOpportunity(id, status);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  if (ok > 0) {
    revalidateOpportunityViews();
  }
  return { ok, failed };
}

export async function revalidateOpportunityAction(formData: FormData) {
  try {
    await revalidateOpportunity(requiredString(formData, "opportunityId"));
  } catch (error) {
    redirect(`/content-opportunities?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateOpportunityViews();
  redirect("/content-opportunities?revalidated=1");
}

export async function generateOpportunitiesAction(formData: FormData) {
  let created = 0;
  try {
    const result = await generateAllOpportunities(requiredString(formData, "projectId"), requiredString(formData, "siteId"));
    created = result.created;
  } catch (error) {
    redirect(`/content-opportunities?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateOpportunityViews();
  // Honest feedback: don't claim "erzeugt" when nothing was created (no fresh
  // signals since the last run). Report the real count instead.
  redirect(`/content-opportunities?generated=${created}`);
}

export async function syncSearchPerformanceAction(formData: FormData) {
  let inserted = 0;
  try {
    const result = await syncSearchPerformance(requiredString(formData, "projectId"), requiredString(formData, "siteId"));
    inserted = result.inserted;
  } catch (error) {
    redirect(`/content-opportunities?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateOpportunityViews();
  // Honest feedback: a sync that inserted nothing must not look like a data refresh.
  redirect(`/content-opportunities?synced=${inserted > 0 ? inserted : "empty"}`);
}

function revalidateOpportunityViews(): void {
  revalidatePath("/");
  revalidatePath("/content-opportunities");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function messageFor(error: unknown): string {
  return friendlyActionError(error, "Opportunity-Aktion konnte nicht gespeichert werden.");
}
