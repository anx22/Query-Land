"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFoundationProject, createFoundationSite } from "../../lib/foundation-api";

export async function createProjectAction(formData: FormData) {
  try {
    await createFoundationProject({
      name: requiredString(formData, "name"),
      slug: slugString(formData, "slug"),
      status: "active",
      defaultLocale: optionalString(formData, "defaultLocale") ?? "de-DE"
    });
  } catch (error) {
    redirect(`/projects?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateProjectViews();
  redirect("/projects?created=project");
}

export async function createSiteAction(formData: FormData) {
  try {
    await createFoundationSite(requiredString(formData, "projectId"), {
      baseUrl: requiredString(formData, "baseUrl"),
      scopeType: enumString(formData, "scopeType", ["domain", "subdomain", "folder"]),
      crawlFrequency: enumString(formData, "crawlFrequency", ["manual", "daily", "weekly"]),
      businessValue: integerString(formData, "businessValue", 1, 100)
    });
  } catch (error) {
    redirect(`/projects?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateProjectViews();
  redirect("/projects?created=site");
}

function revalidateProjectViews(): void {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/api/foundation");
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

function slugString(formData: FormData, key: string): string {
  const value = requiredString(formData, key).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new Error("Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.");
  }
  return value;
}

function enumString<T extends string>(formData: FormData, key: string, allowed: T[]): T {
  const value = requiredString(formData, key) as T;
  if (!allowed.includes(value)) {
    throw new Error(`${key} ist ungültig.`);
  }
  return value;
}

function integerString(formData: FormData, key: string, min: number, max: number): number {
  const value = Number.parseInt(requiredString(formData, key), 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} muss zwischen ${min} und ${max} liegen.`);
  }
  return value;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Aktion konnte nicht gespeichert werden.";
}
