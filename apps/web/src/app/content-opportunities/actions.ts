"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OpportunityStatus } from "@seo-tool/domain-model";
import { generateAllOpportunities, revalidateOpportunity, syncSearchPerformance, transitionOpportunity } from "../../features/content-opportunities";

export async function transitionOpportunityAction(formData: FormData) {
  const status = requiredString(formData, "status") as OpportunityStatus;
  try {
    await transitionOpportunity(requiredString(formData, "opportunityId"), status);
  } catch (error) {
    redirect(`/content-opportunities?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateOpportunityViews();
  redirect(`/content-opportunities?transition=${encodeURIComponent(status)}`);
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
  return error instanceof Error ? error.message : "Opportunity-Aktion konnte nicht gespeichert werden.";
}
