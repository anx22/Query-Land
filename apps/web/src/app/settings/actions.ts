"use server";

import { revalidatePath } from "next/cache";
import { friendlyActionError } from "../../lib/action-errors";
import { redirect } from "next/navigation";
import { apiPost } from "../../lib/api-client";
import { createFoundationIntegration, createFoundationJob } from "../../lib/foundation-api";

const allowedProviders = ["gsc", "ga4"] as const;

type ConnectorProvider = typeof allowedProviders[number];

export async function createConnectorAction(formData: FormData) {
  let provider: ConnectorProvider;
  try {
    const projectId = requiredString(formData, "projectId");
    provider = providerString(formData);
    await createFoundationIntegration({ projectId, provider });
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateSettingsViews();
  redirect(`/settings?created=${provider}`);
}

export async function scheduleConnectorSyncAction(formData: FormData) {
  let provider: ConnectorProvider;
  try {
    const projectId = requiredString(formData, "projectId");
    provider = providerString(formData);
    await createFoundationJob({
      projectId,
      type: "connector_sync",
      subject: provider
    });
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateSettingsViews();
  redirect(`/settings?scheduled=${provider}`);
}

export async function createSourceMapEntryAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    await apiPost("/source-map", {
      projectId,
      repoUrl: requiredString(formData, "repoUrl"),
      urlPattern: requiredString(formData, "urlPattern"),
      templateName: requiredString(formData, "templateName"),
      component: requiredString(formData, "component"),
      repoPath: requiredString(formData, "repoPath")
    });
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateSettingsViews();
  redirect("/settings?sourcemap=1");
}

export async function evaluatePrCheckAction(formData: FormData) {
  let result: { status: string; affectedTemplates: unknown[]; relatedOpportunities: unknown[] };
  try {
    const projectId = requiredString(formData, "projectId");
    const changedPaths = requiredString(formData, "changedPaths")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (changedPaths.length === 0) {
      throw new Error("Mindestens ein geänderter Pfad ist erforderlich.");
    }
    result = await apiPost(`/projects/${projectId}/pr-checks`, { changedPaths });
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateSettingsViews();
  redirect(`/settings?prcheck=${result.status}&prtemplates=${result.affectedTemplates.length}&propps=${result.relatedOpportunities.length}`);
}

function revalidateSettingsViews(): void {
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/api/foundation");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function providerString(formData: FormData): ConnectorProvider {
  const provider = requiredString(formData, "provider") as ConnectorProvider;
  if (!allowedProviders.includes(provider)) {
    throw new Error("Nur Google Search Console und Google Analytics 4 sind aktuell als Datenquellen verfügbar.");
  }
  return provider;
}

function messageFor(error: unknown): string {
  return friendlyActionError(error, "Connector-Aktion konnte nicht gespeichert werden.");
}
