"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ContentRecommendationStatus } from "@seo-tool/domain-model";
import { CONTENT_RECOMMENDATION_STATUSES } from "@seo-tool/domain-model";
import {
  createBrief,
  createProposalFromBrief,
  getBrief,
  transitionBrief,
  updateBrief,
} from "./api";
import {
  addInternalLink,
  parseInternalLinks,
  parseLines,
  parseTerms,
  resolveIntent,
  validateBriefDraft,
} from "./brief-form";

const BASE = "/content-workspace";

function revalidateWorkspace(): void {
  revalidatePath("/");
  revalidatePath(BASE);
  revalidatePath("/api/foundation");
}

/** Create a new brief (from the create form). Mirrors technical-audit/actions. */
export async function createBriefAction(formData: FormData) {
  let briefId: string;
  try {
    const projectId = requiredString(formData, "projectId");
    const siteId = requiredString(formData, "siteId");
    const url = requiredString(formData, "url");
    const title = requiredString(formData, "title");
    const intent = resolveIntent(optionalString(formData, "intent"));

    const draft = { url, title, targetTopic: optionalString(formData, "targetTopic") ?? "", intent };
    const validation = validateBriefDraft(draft);
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }

    const created = await createBrief(projectId, siteId, {
      url,
      title,
      intent,
      opportunityId: optionalString(formData, "opportunityId") ?? null,
      targetTopic: optionalString(formData, "targetTopic"),
      targetQueries: parseLines(optionalString(formData, "targetQueries")),
      sections: parseLines(optionalString(formData, "sections")),
      terms: parseTerms(optionalString(formData, "terms")),
      internalLinks: parseInternalLinks(optionalString(formData, "internalLinks")),
      validationMetric: optionalString(formData, "validationMetric"),
      notes: optionalString(formData, "notes"),
    });
    briefId = created.id;
  } catch (error) {
    redirect(`${BASE}?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateWorkspace();
  redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&saved=created`);
}

/** Edit an existing brief (title, topic, queries, intent, sections, terms, links, metric, notes). */
export async function updateBriefAction(formData: FormData) {
  const briefId = requiredStringOrRedirect(formData, "briefId");
  try {
    const title = requiredString(formData, "title");
    const intent = resolveIntent(optionalString(formData, "intent"));
    const validation = validateBriefDraft({
      url: "placeholder", // url is immutable on update; not part of the form
      title,
      targetTopic: optionalString(formData, "targetTopic") ?? "",
      intent,
    });
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }

    await updateBrief(briefId, {
      title,
      intent,
      targetTopic: optionalString(formData, "targetTopic"),
      targetQueries: parseLines(optionalString(formData, "targetQueries")),
      sections: parseLines(optionalString(formData, "sections")),
      terms: parseTerms(optionalString(formData, "terms")),
      internalLinks: parseInternalLinks(optionalString(formData, "internalLinks")),
      validationMetric: optionalString(formData, "validationMetric"),
      notes: optionalString(formData, "notes"),
    });
  } catch (error) {
    redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateWorkspace();
  redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&saved=updated`);
}

/** Lifecycle transition (draft→ready→in_progress→done, dismiss/reopen). */
export async function transitionBriefAction(formData: FormData) {
  const briefId = requiredStringOrRedirect(formData, "briefId");
  try {
    const statusRaw = requiredString(formData, "status");
    if (!CONTENT_RECOMMENDATION_STATUSES.includes(statusRaw as ContentRecommendationStatus)) {
      throw new Error(`Ungültiger Status: ${statusRaw}`);
    }
    await transitionBrief(briefId, statusRaw as ContentRecommendationStatus);
  } catch (error) {
    redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateWorkspace();
  redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&saved=transitioned`);
}

/** Bridge a brief into the proposal/MCP rail (dev ticket or fix PR). */
export async function createProposalAction(formData: FormData) {
  const briefId = requiredStringOrRedirect(formData, "briefId");
  try {
    const kindRaw = optionalString(formData, "kind") ?? "dev_ticket";
    const kind = kindRaw === "fix_pr" ? "fix_pr" : "dev_ticket";
    await createProposalFromBrief(briefId, kind);
  } catch (error) {
    redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateWorkspace();
  redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&saved=proposal`);
}

/**
 * Add a suggested internal link into an existing brief's internal_links. Reads
 * the brief, appends the suggestion (de-duped by url) and PATCHes it back.
 */
export async function addInternalLinkAction(formData: FormData) {
  const briefId = requiredStringOrRedirect(formData, "briefId");
  try {
    const url = requiredString(formData, "linkUrl");
    const anchorValue = optionalString(formData, "linkAnchor");
    const reason = optionalString(formData, "linkReason") ?? "aus Link-Vorschlägen übernommen";

    const brief = await getBrief(briefId);
    const nextLinks = addInternalLink(brief.internalLinks, {
      url,
      anchor: anchorValue ?? null,
      reason,
    });
    await updateBrief(briefId, { internalLinks: nextLinks });
  } catch (error) {
    redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateWorkspace();
  redirect(`${BASE}?briefId=${encodeURIComponent(briefId)}&saved=linked`);
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

/** Like requiredString but redirects to the base screen on a missing id. */
function requiredStringOrRedirect(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    redirect(`${BASE}?error=${encodeURIComponent(`${key} ist erforderlich.`)}`);
  }
  return (value as string).trim();
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Content-Workspace-Aktion konnte nicht gespeichert werden.";
}
