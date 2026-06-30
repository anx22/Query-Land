"use server";

import { revalidatePath } from "next/cache";
import { friendlyActionError } from "../../lib/action-errors";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_PROJECT_COOKIE, ACTIVE_SITE_COOKIE } from "../../lib/active-project-cookie";
import { createFoundationProject, createFoundationSite } from "../../lib/foundation-api";

const COOKIE_OPTIONS = { path: "/", maxAge: 31536000, sameSite: "lax" as const };

/** Make a project the active one (so the project-centric /projects page binds its forms to it). */
export async function setActiveProjectAction(formData: FormData) {
  const projectId = requiredString(formData, "projectId");
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, COOKIE_OPTIONS);
  // The active site belongs to the previous project — clear it so the new project's scope resolves.
  cookieStore.delete(ACTIVE_SITE_COOKIE);
  revalidateProjectViews();
  // "Open" a website → land on its overview cockpit.
  redirect("/");
}


/**
 * Add a website in ONE step (the primary creation flow): one website = one project, so this creates
 * the project and its site together. Only the address is required; the name defaults to the host.
 */
export async function createWebsiteAction(formData: FormData) {
  let projectId: string;
  let siteId: string;
  try {
    const baseUrl = requiredString(formData, "baseUrl");
    const name = optionalString(formData, "name") ?? hostName(baseUrl);
    const slug = optionalSlug(formData, "slug") ?? deriveSlug(name);
    const project = await createFoundationProject({ name, slug, status: "active", defaultLocale: "de-DE" });
    projectId = project.id;
    const site = await createFoundationSite(projectId, {
      baseUrl,
      scopeType: optionalEnum(formData, "scopeType", ["domain", "subdomain", "folder"]) ?? "domain",
      crawlFrequency: optionalEnum(formData, "crawlFrequency", ["manual", "daily", "weekly"]) ?? "weekly",
      businessValue: optionalInteger(formData, "businessValue", 1, 100) ?? 50
    });
    siteId = site.id;
  } catch (error) {
    redirect(`/projects?error=${encodeURIComponent(messageFor(error))}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, COOKIE_OPTIONS);
  cookieStore.set(ACTIVE_SITE_COOKIE, siteId, COOKIE_OPTIONS);
  revalidateProjectViews();
  redirect("/projects?created=website");
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

function optionalEnum<T extends string>(formData: FormData, key: string, allowed: T[]): T | undefined {
  const raw = optionalString(formData, key) as T | undefined;
  if (raw === undefined) return undefined;
  if (!allowed.includes(raw)) {
    throw new Error(`${key} ist ungültig.`);
  }
  return raw;
}

function optionalInteger(formData: FormData, key: string, min: number, max: number): number | undefined {
  const raw = optionalString(formData, key);
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} muss zwischen ${min} und ${max} liegen.`);
  }
  return value;
}

/** Friendly default name from a URL host, e.g. "https://www.acme.de/x" → "acme.de". */
function hostName(baseUrl: string): string {
  try {
    return new URL(baseUrl).host.replace(/^www\./, "") || baseUrl;
  } catch {
    return baseUrl;
  }
}

function integerString(formData: FormData, key: string, min: number, max: number): number {
  const value = Number.parseInt(requiredString(formData, key), 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} muss zwischen ${min} und ${max} liegen.`);
  }
  return value;
}

function messageFor(error: unknown): string {
  return friendlyActionError(error, "Aktion konnte nicht gespeichert werden.");
}
