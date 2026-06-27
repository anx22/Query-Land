"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProposalKind, ProposalStatus } from "@seo-tool/domain-model";
import { createAiPrompt, createProposal, recordAiSnapshot, scanAeo, transitionProposal } from "../../features/ai-visibility";

export async function createPromptAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const prompt = requiredString(formData, "prompt");
    const market = optionalString(formData, "market");
    await createAiPrompt(projectId, prompt, market);
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?created=1");
}

export async function recordSnapshotAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const promptId = requiredString(formData, "promptId");
    await recordAiSnapshot(projectId, promptId);
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?snapshot=1");
}

export async function scanAeoAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const siteId = requiredString(formData, "siteId");
    const url = requiredString(formData, "url");
    // The page content is fetched automatically from the URL; a manually pasted body (advanced,
    // e.g. for login-gated or JS-only pages) takes precedence so the user can still override.
    const content = optionalString(formData, "content") ?? (await fetchPageContent(url));
    await scanAeo(projectId, siteId, url, content);
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?scanned=1");
}

/** Fetch a page's HTML server-side so a non-expert never has to paste raw source. */
async function fetchPageContent(url: string): Promise<string> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error("Bitte eine gültige Adresse eingeben (inklusive https://).");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Es werden nur http- und https-Adressen unterstützt.");
  }
  let response: Response;
  try {
    response = await fetch(target, {
      headers: { "user-agent": "SEO-Tool AEO-Check", accept: "text/html" },
      redirect: "follow",
    });
  } catch {
    throw new Error("Die Seite konnte nicht abgerufen werden. Bitte prüfen Sie die Adresse und versuchen Sie es erneut.");
  }
  if (!response.ok) {
    throw new Error(`Die Seite antwortete mit Status ${response.status}. Bitte prüfen Sie die Adresse.`);
  }
  const html = (await response.text()).trim();
  if (!html) {
    throw new Error("Die Seite lieferte keinen Inhalt zum Prüfen.");
  }
  return html;
}

export async function createProposalAction(formData: FormData) {
  try {
    const projectId = requiredString(formData, "projectId");
    const kind = requiredString(formData, "kind") as ProposalKind;
    const title = requiredString(formData, "title");
    const body = requiredString(formData, "body");
    const opportunityId = optionalString(formData, "opportunityId");
    await createProposal(projectId, { kind, title, body, opportunityId });
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?proposed=1");
}

export async function transitionProposalAction(formData: FormData) {
  try {
    const proposalId = requiredString(formData, "proposalId");
    const status = requiredString(formData, "status") as ProposalStatus;
    await transitionProposal(proposalId, status);
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect(`/ai-visibility?transition=${encodeURIComponent(status)}`);
}

function revalidateAiVisibilityViews(): void {
  revalidatePath("/");
  revalidatePath("/ai-visibility");
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
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.trim();
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Aktion konnte nicht gespeichert werden.";
}
