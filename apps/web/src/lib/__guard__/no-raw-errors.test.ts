/**
 * GUARD TEST C3 — server actions must never leak raw error text to users.
 *
 * Why this exists: the worst recurring complaint was technical error strings (API paths,
 * HTTP status codes, "fetch failed") shown to end users via `redirect(?error=...)`. The
 * fix was a single chokepoint, friendlyActionError() in lib/action-errors.ts. This test
 * enforces that chokepoint: no actions.ts touches `error.message` directly (only the
 * helper may), and every file with a `messageFor` delegates to friendlyActionError.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", ".."); // apps/web/src
const SCAN_DIRS = [join(SRC, "app"), join(SRC, "features")];

function listActionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listActionFiles(full));
    else if (full.endsWith("actions.ts")) out.push(full);
  }
  return out;
}

describe("guard: action errors are mapped to friendly copy, never leaked raw", () => {
  const files = SCAN_DIRS.flatMap(listActionFiles);

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("no actions.ts references error.message directly (only the central helper may)", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("error.message"));
    expect(
      offenders.map((f) => f.replace(SRC, "src")),
      "error.message must be handled only in lib/action-errors.ts (friendlyActionError)",
    ).toEqual([]);
  });

  it("every messageFor delegates to friendlyActionError", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return src.includes("function messageFor") && !src.includes("friendlyActionError");
    });
    expect(
      offenders.map((f) => f.replace(SRC, "src")),
      "messageFor must delegate to friendlyActionError",
    ).toEqual([]);
  });
});
