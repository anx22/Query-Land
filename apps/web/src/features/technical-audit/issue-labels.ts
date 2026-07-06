/**
 * Shared, framework-agnostic labels for audit-issue rules.
 *
 * Kept in a plain (non-"use client") module so both the client `IssueGroups`
 * component and the server-rendered `IssueFilterBar` can import `ruleLabel`
 * without crossing the server/client boundary. Importing a function from a
 * "use client" module into a server component and calling it throws
 * ("Attempted to call ruleLabel() from the server …").
 */
import type { IssueGroup } from "../../lib/audit-api";

export const RULE_LABEL: Record<IssueGroup["rule"], string> = {
  http_error: "HTTP-Fehler",
  redirect_chain: "Redirect-Kette",
  broken_link: "Defekter Link",
  missing_title: "Fehlender Title",
  duplicate_title: "Doppelter Title",
  title_too_long: "Title zu lang",
  title_too_short: "Title zu kurz",
  canonical_mismatch: "Canonical-Abweichung",
  missing_canonical: "Fehlender Canonical",
  missing_meta_description: "Fehlende Meta-Description",
  duplicate_meta_description: "Doppelte Meta-Description",
  meta_description_too_long: "Meta-Description zu lang",
  meta_description_too_short: "Meta-Description zu kurz",
  missing_h1: "Fehlende H1",
  multiple_h1: "Mehrere H1",
  thin_content: "Dünner Inhalt",
  image_missing_alt: "Bild ohne Alt-Text",
  missing_viewport: "Kein Viewport-Tag",
  missing_html_lang: "Kein html-lang",
  mixed_content: "Mixed Content",
  hreflang_invalid: "Ungültiges hreflang",
  structured_data_missing: "Keine strukturierten Daten",
  lcp_slow: "LCP zu langsam",
  cls_high: "CLS zu hoch",
  inp_slow: "INP zu langsam",
  ttfb_slow: "TTFB zu langsam",
};

export function ruleLabel(rule: IssueGroup["rule"]): string {
  return RULE_LABEL[rule] ?? rule;
}
