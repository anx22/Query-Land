"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost } from "../../lib/api-client";

export async function createKeywordGroupAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    await apiPost(`/projects/${projectId}/keyword-groups`, {
      name: requiredString(formData, "name"),
      topic: optionalString(formData, "topic")
    });
  } catch (error) {
    redirect(`/keywords-rank?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateKeywordViews();
  redirect("/keywords-rank?group=1");
}

export async function addKeywordsAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const phrases = requiredString(formData, "phrases")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (phrases.length === 0) {
      throw new Error("Mindestens ein Keyword ist erforderlich.");
    }
    const brandTerms = (optionalString(formData, "brandTerms") ?? "")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
    const groupId = optionalString(formData, "groupId");
    await apiPost(`/projects/${projectId}/keywords`, {
      groupId: groupId || null,
      brandTerms,
      keywords: phrases.map((phrase) => ({ phrase }))
    });
  } catch (error) {
    redirect(`/keywords-rank?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateKeywordViews();
  redirect("/keywords-rank?added=1");
}

function revalidateKeywordViews(): void {
  revalidatePath("/");
  revalidatePath("/keywords-rank");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Keyword-Aktion konnte nicht gespeichert werden.";
}
