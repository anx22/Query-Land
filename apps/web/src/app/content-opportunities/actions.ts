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
  try {
    await generateAllOpportunities(requiredString(formData, "projectId"), requiredString(formData, "siteId"));
  } catch (error) {
    redirect(`/content-opportunities?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateOpportunityViews();
  redirect("/content-opportunities?generated=1");
}

export async function syncSearchPerformanceAction(formData: FormData) {
  try {
    await syncSearchPerformance(requiredString(formData, "projectId"), requiredString(formData, "siteId"));
  } catch (error) {
    redirect(`/content-opportunities?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateOpportunityViews();
  redirect("/content-opportunities?synced=1");
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
