"use server";

import { revalidatePath } from "next/cache";
import { friendlyActionError } from "../../lib/action-errors";
import { redirect } from "next/navigation";
import { apiPost } from "../../lib/api-client";
import { createFoundationIntegration } from "../../lib/foundation-api";
import { callInternalApi } from "../../lib/server-api";
import { runGscRefreshForProject } from "../../lib/gsc-refresh";

const allowedProviders = ["gsc", "ga4", "pagespeed"] as const;

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
    // Schedule via the connector's own day-scoped sync-schedule endpoint (which carries the required
    // integrationId). The old generic-job path created a connector_sync job WITHOUT integrationId,
    // which the drain always rejected — so "geplant" was shown while the job could never run.
    const integrationId = await findIntegrationId(projectId, provider);
    if (!integrationId) {
      throw new Error("Diese Datenquelle ist noch nicht verbunden.");
    }
    const response = await callInternalApi("POST", `/integrations/${integrationId}/sync/schedule`);
    if (response.status >= 400) {
      throw new Error("Der Datenabgleich konnte nicht geplant werden.");
    }
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateSettingsViews();
  redirect(`/settings?scheduled=${provider}`);
}

/**
 * Run a full GSC refresh right now (search-performance + rank/visibility + URL index status) so the
 * user does not have to wait for the daily cron. Honest feedback: `synced=empty` when the connection
 * works but Google returned no data yet (e.g. a brand-new property).
 */
export async function syncConnectorNowAction(formData: FormData) {
  let outcome: "done" | "empty" = "done";
  try {
    const projectId = requiredString(formData, "projectId");
    const result = await runGscRefreshForProject(callInternalApi, projectId);
    if (!result.connected) {
      throw new Error("Google Search Console ist für dieses Projekt nicht verbunden.");
    }
    const anyData = result.searchPerformanceRows > 0 || result.rankKeywords > 0 || result.urlsInspected > 0;
    outcome = anyData ? "done" : "empty";
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateSettingsViews();
  redirect(`/settings?synced=${outcome}`);
}

/** Find the integration id for a project+provider via the internal API (or null when not connected). */
async function findIntegrationId(projectId: string, provider: ConnectorProvider): Promise<string | null> {
  const response = await callInternalApi("GET", "/integrations");
  const integrations = (response.body as { data?: Array<{ id: string; provider: string; projectId?: string }> } | null)?.data ?? [];
  return integrations.find((integration) => integration.provider === provider && integration.projectId === projectId)?.id ?? null;
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
