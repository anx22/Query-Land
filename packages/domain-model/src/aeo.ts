// AEO — Answer Engine Optimization (§5 Modul 7, Welle 7). Heuristische, content-basierte Checks,
// ob eine Seite für Antwort-Engines optimiert ist. Reine Funktion über den (vom Crawler/Nutzer
// bereitgestellten) HTML-Inhalt — die abgeleitete Bewertung erbt damit Crawl-Confidence (Klasse A).

import type { SourceConfidence } from "./integrations.js";

export interface AeoCheck {
  check: string;
  passed: boolean;
}

export interface AeoResult {
  score: number;
  checks: AeoCheck[];
}

export interface AeoAssessment {
  id: string;
  projectId: string;
  siteId: string;
  url: string;
  score: number;
  checks: AeoCheck[];
  sourceConfidence: SourceConfidence;
  assessedAt: string;
}

const CHECKS: Array<{ check: string; test: (content: string) => boolean }> = [
  { check: "h1", test: (content) => /<h1[\s>]/i.test(content) },
  { check: "structured_data", test: (content) => /application\/ld\+json/i.test(content) || /schema\.org/i.test(content) },
  { check: "question_heading", test: (content) => /<h([2-3])[^>]*>[^<]*\?\s*<\/h\1>/i.test(content) },
  { check: "list", test: (content) => /<(ul|ol)[\s>]/i.test(content) },
  // [^<] hält den Match innerhalb EINES <p>-Elements (kein Überspringen von </p><p>-Grenzen).
  { check: "concise_answer", test: (content) => /<p[\s>][^<]{40,400}<\/p>/i.test(content) }
];

export function analyzeAeo(content: string): AeoResult {
  const text = typeof content === "string" ? content : "";
  const checks: AeoCheck[] = CHECKS.map((entry) => ({ check: entry.check, passed: entry.test(text) }));
  const passed = checks.filter((check) => check.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, checks };
}
