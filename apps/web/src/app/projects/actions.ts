"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_PROJECT_COOKIE, ACTIVE_SITE_COOKIE } from "../../lib/active-project-cookie";
import { createFoundationProject, createFoundationSite } from "../../lib/foundation-api";

const COOKIE_OPTIONS = { path: "/", maxAge: 31536000, sameSite: "lax" as const };

export async function createProjectAction(formData: FormData) {
  let projectId: string;
  try {
    const name = requiredString(formData, "name");
    // Slug is a technical detail — derive it from the name unless explicitly provided (advanced).
    const slug = optionalSlug(formData, "slug") ?? deriveSlug(name);
    const project = await createFoundationProject({
      name,
      slug,
      status: "active",
      defaultLocale: optionalString(formData, "defaultLocale") ?? "de-DE"
    });
    projectId = project.id;
  } catch (error) {
    redirect(`/projects?error=${encodeURIComponent(messageFor(error))}`);
  }

  // Activate the just-created project so the overview and wizard immediately reflect it
  // (otherwise the user would keep onboarding the previously active project).
  (await cookies()).set(ACTIVE_PROJECT_COOKIE, projectId, COOKIE_OPTIONS);
  revalidateProjectViews();
  redirect("/projects?created=project");
}

export async function createSiteAction(formData: FormData) {
  let projectId: string;
  let siteId: string;
  try {
    projectId = requiredString(formData, "projectId");
    const site = await createFoundationSite(projectId, {
      baseUrl: requiredString(formData, "baseUrl"),
      scopeType: enumString(formData, "scopeType", ["domain", "subdomain", "folder"]),
      crawlFrequency: enumString(formData, "crawlFrequency", ["manual", "daily", "weekly"]),
      businessValue: integerString(formData, "businessValue", 1, 100)
    });
    siteId = site.id;
  } catch (error) {
    redirect(`/projects?error=${encodeURIComponent(messageFor(error))}`);
  }

  // Make the new website the active crawl/audit scope for its project.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, COOKIE_OPTIONS);
  cookieStore.set(ACTIVE_SITE_COOKIE, siteId, COOKIE_OPTIONS);
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

/** Use an explicitly provided slug (validated), or undefined to fall back to deriving one. */
function optionalSlug(formData: FormData, key: string): string | undefined {
  const raw = optionalString(formData, key);
  if (raw === undefined) return undefined;
  const value = raw.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new Error("Kennung darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.");
  }
  return value;
}

/** Derive a URL-safe slug from a human project name (used when no slug is entered). */
function deriveSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("Bitte einen Namen mit Buchstaben oder Zahlen angeben.");
  }
  return slug;
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
