import assert from "node:assert/strict";
import test from "node:test";
import { aggregateReferringDomains, diffBacklinks, summarizeAuthority, type BacklinkLike } from "@seo-tool/domain-model";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-4.1/4.2/4.3: Authority / Backlinks (Welle 5). Deterministischer GSC-Links-Stub (Klasse B,
// DEC-002) der je Snapshot-Runde mutiert, plus reine Diff/Authority-Funktionen.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/backlinks.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

const BEFORE: BacklinkLike[] = [
  { sourceUrl: "https://a.example/1", sourceDomain: "a.example", targetUrl: "https://me/x", anchorText: "brand", linkType: "follow" },
  { sourceUrl: "https://b.example/1", sourceDomain: "b.example", targetUrl: "https://me/x", anchorText: "click here", linkType: "nofollow" }
];
const AFTER: BacklinkLike[] = [
  { sourceUrl: "https://a.example/1", sourceDomain: "a.example", targetUrl: "https://me/x", anchorText: "brand", linkType: "follow" },
  { sourceUrl: "https://c.example/1", sourceDomain: "c.example", targetUrl: "https://me/y", anchorText: "brand", linkType: "follow" }
];

test("diffBacklinks reports new/lost backlinks and referring domains (pure)", () => {
  const diff = diffBacklinks(BEFORE, AFTER);
  assert.equal(diff.newBacklinks.length, 1);
  assert.equal(diff.newBacklinks[0].sourceDomain, "c.example");
  assert.equal(diff.lostBacklinks.length, 1);
  assert.equal(diff.lostBacklinks[0].sourceDomain, "b.example");
  assert.deepEqual(diff.newReferringDomains, ["c.example"]);
  assert.deepEqual(diff.lostReferringDomains, ["b.example"]);
  assert.equal(diff.netBacklinkChange, 0);
  assert.equal(diff.netReferringDomainChange, 0);
});

test("authority summary computes follow ratio, anchors and top targets (pure)", () => {
  const summary = summarizeAuthority(BEFORE);
  assert.equal(summary.totalBacklinks, 2);
  assert.equal(summary.referringDomains, 2);
  assert.equal(summary.followRatio, 0.5);
  assert.equal(summary.topTargetUrls[0].targetUrl, "https://me/x");
  assert.equal(summary.topTargetUrls[0].referringDomains, 2);
  const domains = aggregateReferringDomains(BEFORE);
  assert.equal(domains.length, 2);
  assert.ok(domains.every((domain) => domain.backlinks === 1));
});

test("import without a connected links provider persists an empty snapshot (honest empty state)", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "Authority", slug: "authority" })).id;
    await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://acme.example.com", scopeType: "domain" });

    const imported = await app("POST", `/projects/${projectId}/backlinks/import`, {});
    assert.equal(imported.status, 202);
    const result = data<{ totalBacklinks: number; referringDomains: number; snapshotId: string }>(imported);
    // No real authority/links provider is connected yet -> no backlinks, but a snapshot is recorded.
    assert.equal(result.totalBacklinks, 0);
    assert.equal(result.referringDomains, 0);
    assert.ok(result.snapshotId);

    const rows = data<unknown[]>(await app("GET", `/projects/${projectId}/backlinks?limit=100`));
    assert.equal(rows.length, 0);

    const refDomains = data<unknown[]>(await app("GET", `/projects/${projectId}/referring-domains`));
    assert.equal(refDomains.length, 0);

    const authority = data<{ totalBacklinks: number }>(await app("GET", `/projects/${projectId}/authority`));
    assert.equal(authority.totalBacklinks, 0);
  } finally {
    await store.close();
  }
});

test("a second import diffs two snapshots (empty diff when no provider is connected)", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "Diff", slug: "diff" })).id;
    await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://acme.example.com", scopeType: "domain" });

    await app("POST", `/projects/${projectId}/backlinks/import`, {});
    // A single snapshot has no predecessor to diff against -> 404 (not a misleading all-new diff).
    const oneSnapshot = await app("GET", `/projects/${projectId}/backlinks/diff`);
    assert.equal(oneSnapshot.status, 404);
    assert.equal((oneSnapshot.body as { error: { code: string } }).error.code, "no_snapshots");

    await app("POST", `/projects/${projectId}/backlinks/import`, {});

    const diff = data<{ newReferringDomains: string[]; lostReferringDomains: string[]; newBacklinks: unknown[]; lostBacklinks: unknown[] }>(await app("GET", `/projects/${projectId}/backlinks/diff`));
    assert.equal(diff.newReferringDomains.length, 0);
    assert.equal(diff.lostReferringDomains.length, 0);
    assert.equal(diff.newBacklinks.length, 0);
    assert.equal(diff.lostBacklinks.length, 0);

    const snapshots = data<unknown[]>(await app("GET", `/projects/${projectId}/backlink-snapshots`));
    assert.equal(snapshots.length, 2, "snapshot history accumulates even when empty");
  } finally {
    await store.close();
  }
});

test("import requires a site; diff requires a snapshot", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = data<{ id: string }>(await app("POST", "/projects", { name: "Empty", slug: "empty" })).id;
    const noSite = await app("POST", `/projects/${projectId}/backlinks/import`, {});
    assert.equal(noSite.status, 400);
    assert.equal((noSite.body as { error: { code: string } }).error.code, "no_site");

    await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://acme.example.com", scopeType: "domain" });
    const noSnapshot = await app("GET", `/projects/${projectId}/backlinks/diff`);
    assert.equal(noSnapshot.status, 404);
    assert.equal((noSnapshot.body as { error: { code: string } }).error.code, "no_snapshots");
  } finally {
    await store.close();
  }
});
