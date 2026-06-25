import type { AsyncDatabase } from "../../src/db/index.js";
import type { BackendStore } from "../../src/store.js";

/**
 * Test-only baseline foundation: a `proj-demo` project and a `site-demo` site.
 *
 * Production no longer seeds any demo project/site (see src/seed.ts) — a fresh database starts
 * empty. Several API suites were written against the old hard-coded `proj-demo`/`site-demo` ids,
 * so this helper recreates exactly that baseline for those tests.
 *
 * The project id is derived from the slug (`proj-${slug}` in project-store), so slug "demo"
 * yields `proj-demo`. The site id is passed explicitly (honored only for direct store callers).
 */
export async function seedDemoFoundation(store: BackendStore): Promise<void> {
  await store.createProject({
    name: "Demo Property",
    slug: "demo",
    status: "active",
    defaultLocale: "de-DE",
    markets: [{ country: "DE", language: "de", device: "desktop", searchEngine: "google" }]
  });
  await store.createSite("proj-demo", {
    id: "site-demo",
    scopeType: "domain",
    baseUrl: "https://example.com",
    crawlFrequency: "weekly",
    businessValue: 80
  });
}

/**
 * Seed the two `pending` integrations (`int-gsc-demo`, `int-ga4-demo`) with EMPTY auth_config,
 * representing accounts that are prepared but not yet authenticated ("missing credentials").
 *
 * The public `createIntegration` route always writes stub credentials (so a synced account reads
 * "connected"); it cannot produce the missing-credentials state. Tests that exercise that failure
 * mode insert the rows directly via the db handle from `createStoreWithDatabase`. Requires the
 * `proj-demo` project to exist first (FK) — call after `seedDemoFoundation`.
 */
export async function seedPendingIntegrations(db: AsyncDatabase): Promise<void> {
  const now = "2026-06-02T00:00:00.000Z";
  const insert = db.prepare(
    `INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`
  );
  await insert.run("int-gsc-demo", "proj-demo", "gsc", "pending", "B", null, null, now, now);
  await insert.run("int-ga4-demo", "proj-demo", "ga4", "pending", "A", null, null, now, now);
}
