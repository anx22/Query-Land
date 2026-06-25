import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-1.1: Source Map real (§4.3 — der Differenzierer). Beweist Upsert von url->template->repo,
// Auflösung eines Source-Anchors (exakt + Präfix) und Deploy-Marker.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/source-map.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

async function freshProject(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string): Promise<string> {
  return data<{ id: string }>(await app("POST", "/projects", { name: `SM ${slug}`, slug })).id;
}

test("upsert source map entry creates and then updates without duplicating", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "upsert");
    const created = await app("POST", "/source-map", {
      projectId, repoUrl: "https://github.com/acme/site", urlPattern: "https://acme.test/pricing",
      templateName: "PricingPage", component: "Pricing", repoPath: "apps/web/app/pricing/page.tsx", confidence: "exact"
    });
    assert.equal(created.status, 201);
    const entry = data<{ urlPattern: string; repoPath: string; confidence: string }>(created);
    assert.equal(entry.repoPath, "apps/web/app/pricing/page.tsx");
    assert.equal(entry.confidence, "exact");

    // Re-upsert same pattern+template with a new confidence -> update, no duplicate.
    await app("POST", "/source-map", {
      projectId, repoUrl: "https://github.com/acme/site", urlPattern: "https://acme.test/pricing",
      templateName: "PricingPage", component: "Pricing", repoPath: "apps/web/app/pricing/page.tsx", confidence: "manifest"
    });
    const mine = data<Array<{ urlPattern: string; confidence: string }>>(await app("GET", "/source-map")).filter((e) => e.urlPattern === "https://acme.test/pricing");
    assert.equal(mine.length, 1, "no duplicate mapping for same url+template");
    assert.equal(mine[0]?.confidence, "manifest");
  } finally {
    await store.close();
  }
});

test("resolve source anchor matches exact pattern and longest prefix", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "resolve");
    await app("POST", "/source-map", { projectId, repoUrl: "https://github.com/acme/site", urlPattern: "https://acme.test/blog", templateName: "BlogIndex", component: "Blog", repoPath: "apps/web/app/blog/page.tsx" });
    await app("POST", "/source-map", { projectId, repoUrl: "https://github.com/acme/site", urlPattern: "https://acme.test/blog/post", templateName: "BlogPost", component: "Blog", repoPath: "apps/web/app/blog/[slug]/page.tsx" });

    const exact = data<{ repoPath: string } | null>(await app("GET", "/source-map/resolve?url=" + encodeURIComponent("https://acme.test/blog")));
    assert.equal(exact?.repoPath, "apps/web/app/blog/page.tsx");

    // Prefix: longest pattern wins.
    const nested = data<{ repoPath: string } | null>(await app("GET", "/source-map/resolve?url=" + encodeURIComponent("https://acme.test/blog/post/123")));
    assert.equal(nested?.repoPath, "apps/web/app/blog/[slug]/page.tsx");

    const miss = data<unknown>(await app("GET", "/source-map/resolve?url=" + encodeURIComponent("https://other.test/x")));
    assert.equal(miss, null);
  } finally {
    await store.close();
  }
});

test("deploy markers can be created and listed per project", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "deploy");
    const created = await app("POST", `/projects/${projectId}/deploy-markers`, { commitSha: "abc1234", metadata: { env: "production" } });
    assert.equal(created.status, 201);
    assert.equal(data<{ commitSha: string }>(created).commitSha, "abc1234");

    const list = data<Array<{ commitSha: string; metadata: Record<string, unknown> }>>(await app("GET", `/projects/${projectId}/deploy-markers`));
    assert.equal(list.length, 1);
    assert.equal(list[0]?.metadata.env, "production");
  } finally {
    await store.close();
  }
});

test("source map upsert validates required fields", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await freshProject(app, "validate");
    const bad = await app("POST", "/source-map", { projectId, repoUrl: "https://github.com/acme/site", urlPattern: "" });
    assert.equal(bad.status, 400);
  } finally {
    await store.close();
  }
});
