/**
 * GUARD TEST C2 — forbidden user-facing copy may never reappear in the UI.
 *
 * Why this exists: terminology/leak drift kept coming back across reviews — technical
 * status text ("API verbunden/offline/nicht erreichbar"), the old "Projekt" wording,
 * an env-var name in copy (RESEND_API_KEY), "Backend prüfen". This test scans the
 * rendered layer (app/** + features/** .tsx) and fails if any forbidden phrase shows up
 * as actual markup (comment-only lines are ignored), so the drift can't silently return.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", ".."); // apps/web/src
const SCAN_DIRS = [join(SRC, "app"), join(SRC, "features")];

const FORBIDDEN: Array<{ phrase: string; why: string }> = [
  { phrase: "API verbunden", why: "technical jargon — use 'Daten verbunden'" },
  { phrase: "API offline", why: "technical jargon — use 'Daten offline'" },
  { phrase: "API nicht erreichbar", why: "technical jargon — use 'Daten momentan nicht erreichbar'" },
  { phrase: "Backend prüfen", why: "exposes backend talk to end users" },
  { phrase: "Aktives Projekt", why: "1 Projekt = 1 Website — say 'Aktive Website'" },
  { phrase: "+ Projekt anlegen", why: "1 Projekt = 1 Website — say '+ Website hinzufügen'" },
  { phrase: "Projekte & Sites", why: "old IA wording" },
  { phrase: "RESEND_API_KEY", why: "internal env-var name must not appear in UI copy" },
  { phrase: "Crawl-Lauf", why: "user copy uses 'Analyse' (glossary tooltip introduces 'Crawl')" },
  { phrase: "Crawl-Läufe", why: "user copy uses 'Analysen'" },
];

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsx(full));
    } else if (full.endsWith(".tsx") && !full.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

/** Drop comment-only lines so JSDoc/explanatory comments can mention forbidden terms. */
function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
}

describe("guard: forbidden user-facing copy is absent from the UI layer", () => {
  const files = SCAN_DIRS.flatMap(listTsx);

  it("scans a non-trivial number of UI files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const { phrase, why } of FORBIDDEN) {
    it(`never renders "${phrase}" (${why})`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (!isCommentLine(line) && line.includes(phrase)) {
            hits.push(`${file.replace(SRC, "src")}:${i + 1}`);
          }
        });
      }
      expect(hits, `"${phrase}" found in UI markup at:\n${hits.join("\n")}`).toEqual([]);
    });
  }
});
