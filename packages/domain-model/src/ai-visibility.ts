import type { SourceConfidence } from "./integrations.js";

// AI Visibility (§5 Modul 7, Welle 7). Verfolgt, ob die eigene Domain in LLM-Antworten auf
// getrackte Prompts zitiert/erwähnt wird. WICHTIG: LLM-Interpretation ist Confidence-Klasse E und
// gemäß §2.3/§2.7 NIE als Opportunity-Evidenz zulässig — diese Daten sind ein Signal, kein Beweis.

export interface AiPrompt {
  id: string;
  projectId: string;
  prompt: string;
  market: string;
  createdAt: string;
}

export interface AiAnswerSnapshot {
  id: string;
  projectId: string;
  promptId: string;
  answer: string;
  citedDomains: string[];
  brandMentioned: boolean;
  ourCited: boolean;
  capturedAt: string;
  sourceConfidence: SourceConfidence;
}

export interface AiVisibilityScore {
  prompts: number;
  citedPrompts: number;
  brandMentions: number;
  score: number;
}

// Anteil der getrackten Prompts, in denen die eigene Domain zitiert wird (0–100). Rein, testbar.
export function computeAiVisibilityScore(items: Array<{ ourCited: boolean; brandMentioned: boolean }>): AiVisibilityScore {
  const prompts = items.length;
  const citedPrompts = items.filter((item) => item.ourCited).length;
  const brandMentions = items.filter((item) => item.brandMentioned).length;
  const score = prompts > 0 ? Math.round((citedPrompts / prompts) * 100) : 0;
  return { prompts, citedPrompts, brandMentions, score };
}
