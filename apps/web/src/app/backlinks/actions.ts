"use server";

import { revalidatePath } from "next/cache";
import { friendlyActionError } from "../../lib/action-errors";
import { redirect } from "next/navigation";
import { importBacklinks } from "../../features/backlinks";

export async function importBacklinksAction(formData: FormData) {
  try {
    await importBacklinks(requiredString(formData, "projectId"));
  } catch (error) {
    redirect(`/backlinks?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateBacklinkViews();
  redirect("/backlinks?imported=1");
}

function revalidateBacklinkViews(): void {
  revalidatePath("/");
  revalidatePath("/backlinks");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function messageFor(error: unknown): string {
  return friendlyActionError(error, "Backlink-Import konnte nicht gestartet werden.");
}
