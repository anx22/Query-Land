import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createSQLiteStore } from "../src/sqlite-store.js";

// WP-2.1: Keyword Core (Modul 3). Beweist Gruppen, Bulk-Add mit Intent/Brand/Funnel-
// Klassifikation, Dedupe, Filter/Pagination und URL-Mapping (DACH, DEC-003).
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/keywords.test.js

type ApiResponse = { status: number; body: unknown };

function testApp() {
  const store = createSQLiteStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function freshProject(app: ReturnType<typeof testApp>["app"], slug: string): Promise<string> {
  return data<{ id: string }>(await app("POST", "/projects", { name: `KW ${slug}`, slug })).id;
}

test("keyword groups can be created and listed; duplicate name is rejected", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await freshProject(app, "groups");
    const group = await app("POST", `/projects/${projectId}/keyword-groups`, { name: "Pricing", topic: "Money pages" });
    assert.equal(group.status, 201);
    assert.equal(data<{ name: string }>(group).name, "Pricing");

    const groups = data<Array<{ name: string }>>(await app("GET", `/projects/${projectId}/keyword-groups`));
    assert.ok(groups.some((g) => g.name === "Pricing"));

    const dup = await app("POST", `/projects/${projectId}/keyword-groups`, { name: "Pricing" });
    assert.equal(dup.status, 409);
  } finally {
    store.close();
  }
});

test("adding keywords classifies intent, funnel stage and brand, and dedupes", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await freshProject(app, "classify");
    const result = await app("POST", `/projects/${projectId}/keywords`, {
      brandTerms: ["AuraSEO"],
      keywords: [
        { phrase: "seo tool kaufen" },
        { phrase: "ahrefs vs semrush" },
        { phrase: "wie funktioniert seo" },
        { phrase: "AuraSEO login" }
      ]
    });
    assert.equal(result.status, 201);
    const body = data<{ inserted: number; updated: number; keywords: Array<{ phrase: string; intent: string; funnelStage: string; brand: boolean }> }>(result);
    assert.equal(body.inserted, 4);
    const byPhrase = Object.fromEntries(body.keywords.map((k) => [k.phrase, k]));
    assert.equal(byPhrase["seo tool kaufen"].intent, "transactional");
    assert.equal(byPhrase["seo tool kaufen"].funnelStage, "decision");
    assert.equal(byPhrase["ahrefs vs semrush"].intent, "comparison");
    assert.equal(byPhrase["wie funktioniert seo"].intent, "informational");
    assert.equal(byPhrase["AuraSEO login"].intent, "navigational");
    assert.equal(byPhrase["AuraSEO login"].brand, true);

    // Re-adding the same phrase (case/space-insensitive) updates, not duplicates.
    const again = data<{ inserted: number; updated: number }>(await app("POST", `/projects/${projectId}/keywords`, { keywords: [{ phrase: "SEO Tool kaufen" }] }));
    assert.equal(again.inserted, 0);
    assert.equal(again.updated, 1);
  } finally {
    store.close();
  }
});

test("keywords can be filtered by intent and brand, and mapped to a URL", async () => {
  const { app, store } = testApp();
  try {
    const projectId = await freshProject(app, "filter");
    await app("POST", `/projects/${projectId}/keywords`, {
      brandTerms: ["acme"],
      keywords: [
        { phrase: "preis acme tool" },
        { phrase: "acme kontakt" },
        { phrase: "seo guide" }
      ]
    });

    const transactional = data<Array<{ phrase: string }>>(await app("GET", `/projects/${projectId}/keywords?intent=transactional`));
    assert.ok(transactional.some((k) => k.phrase === "preis acme tool"));

    const brand = data<Array<{ phrase: string; brand: boolean }>>(await app("GET", `/projects/${projectId}/keywords?brand=true`));
    assert.ok(brand.every((k) => k.brand));
    assert.ok(brand.length >= 2);

    const list = data<Array<{ id: string; phrase: string }>>(await app("GET", `/projects/${projectId}/keywords?limit=50`));
    const target = list.find((k) => k.phrase === "seo guide");
    assert.ok(target);
    const mapped = data<{ targetUrl: string | null }>(await app("POST", `/projects/${projectId}/keywords/${target!.id}/map-url`, { targetUrl: "https://acme.test/guide" }));
    assert.equal(mapped.targetUrl, "https://acme.test/guide");
  } finally {
    store.close();
  }
});
