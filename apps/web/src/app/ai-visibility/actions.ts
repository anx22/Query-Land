"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProposalKind, ProposalStatus } from "@seo-tool/domain-model";
import { createAiPrompt, createProposal, recordAiSnapshot, scanAeo, transitionProposal } from "../../features/ai-visibility";

export async function createPromptAction(formData: FormData) {
  const projectId = requiredString(formData, "projectId");
  const prompt = requiredString(formData, "prompt");
  const market = optionalString(formData, "market");
  try {
    await createAiPrompt(projectId, prompt, market);
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?created=1");
}

export async function recordSnapshotAction(formData: FormData) {
  const projectId = requiredString(formData, "projectId");
  const promptId = requiredString(formData, "promptId");
  try {
    await recordAiSnapshot(projectId, promptId);
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?snapshot=1");
}

export async function scanAeoAction(formData: FormData) {
  const projectId = requiredString(formData, "projectId");
  const siteId = requiredString(formData, "siteId");
  const url = requiredString(formData, "url");
  const content = requiredString(formData, "content");
  try {
    await scanAeo(projectId, siteId, url, content);
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?scanned=1");
}

export async function createProposalAction(formData: FormData) {
  const projectId = requiredString(formData, "projectId");
  const kind = requiredString(formData, "kind") as ProposalKind;
  const title = requiredString(formData, "title");
  const body = requiredString(formData, "body");
  const opportunityId = optionalString(formData, "opportunityId");
  try {
    await createProposal(projectId, { kind, title, body, opportunityId });
  } catch (error) {
    redirect(`/ai-visibility?error=${encodeURIComponent(messageFor(error))}`);
  }
  revalidateAiVisibilityViews();
  redirect("/ai-visibility?proposed=1");
}

export async function transitionProposalAction(formData: FormData) {
  const proposalId = requiredString(formData, "proposalId");
  const status = requiredString(formData, "status") as ProposalStatus;
  try {
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
