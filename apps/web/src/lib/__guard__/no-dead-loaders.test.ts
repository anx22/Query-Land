/**
 * GUARD TEST — the "Nahtstellen-Fehlerklasse" (data-seam bugs) must not creep back.
 *
 * Two archetypes this enforces:
 *
 *   A3/Tier-3 — dead duplicate loaders. Each feature module (features/<x>/api.ts)
 *   used to ship its own `load*()` server loader AND the screens loaded via
 *   lib/<x>-api.ts, leaving the feature loader orphaned. We removed them; this test
 *   keeps them gone. Feature api.ts modules may export mutations (create/delete/
 *   sync …) but NOT a data loader named `load*` — those belong in lib/-api.ts.
 *
 *   A4/A6 — a success-feedback param a server action redirects to must have a
 *   matching handler in a feedbackMessage()/notice branch. This catches "dead
 *   display text": copy that promises success for a trigger that was never wired
 *   (or whose param was renamed). We scan each app/<screen> that has both an
 *   actions.ts using `redirect("...?param=…")` and a page.tsx, and assert every
 *   such param is referenced in the page.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", ".."); // apps/web/src

function walk(dir: string, match: (full: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, match));
    else if (match(full)) out.push(full);
  }
  return out;
}

describe("guard: no dead duplicate feature loaders", () => {
  const featureApiFiles = walk(join(SRC, "features"), (f) => f.endsWith("/api.ts"));
  const allSrc = walk(SRC, (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".test.ts"));

  it("finds the feature api modules", () => {
    expect(featureApiFiles.length).toBeGreaterThan(2);
  });

  it("every load* export in a feature api.ts is actually imported somewhere (no dead loaders)", () => {
    // The recurring smell: a feature ships load*() while the screen loads via lib/*-api.ts,
    // orphaning the feature loader. Flag any load* export with zero references outside its
    // own definition file. (Targeted helper fetches like loadAuditIssueHistory that ARE used
    // by an action pass — they have real importers.)
    const dead: string[] = [];
    for (const file of featureApiFiles) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(load[A-Z][A-Za-z0-9]*)/g)) {
        const name = m[1];
        const referencedElsewhere = allSrc.some(
          (other) => other !== file && readFileSync(other, "utf8").includes(name)
        );
        if (!referencedElsewhere) dead.push(`${file.replace(SRC, "src")} → ${name}`);
      }
    }
    expect(
      dead,
      "Dead feature loader(s). Move screen data loaders to lib/*-api.ts and delete the feature duplicate.",
    ).toEqual([]);
  });
});

describe("guard: success-feedback params have a handler on the page", () => {
  // Params that are generic infrastructure, not per-action success copy.
  const IGNORED = new Set(["error"]);

  const appDir = join(SRC, "app");
  const screens = readdirSync(appDir).filter((entry) => {
    const full = join(appDir, entry);
    return statSync(full).isDirectory() && existsSync(join(full, "actions.ts")) && existsSync(join(full, "page.tsx"));
  });

  it("finds screens with both actions.ts and page.tsx", () => {
    expect(screens.length).toBeGreaterThan(3);
  });

  for (const screen of screens) {
    it(`every redirect success param in app/${screen}/actions.ts is handled by its page`, () => {
      const actionsSrc = readFileSync(join(appDir, screen, "actions.ts"), "utf8");
      const pageSrc = readFileSync(join(appDir, screen, "page.tsx"), "utf8");

      // Collect ?param names from redirect("/<path>?param=…") / `?param=${…}` / &param=
      const params = new Set<string>();
      for (const m of actionsSrc.matchAll(/[?&]([a-zA-Z][a-zA-Z0-9_]*)=/g)) {
        const name = m[1];
        if (!IGNORED.has(name)) params.add(name);
      }

      const unhandled = [...params].filter((p) => !pageSrc.includes(p));
      expect(
        unhandled,
        `Params redirected to by app/${screen}/actions.ts but never read in page.tsx — dead success copy or renamed param.`,
      ).toEqual([]);
    });
  }
});
