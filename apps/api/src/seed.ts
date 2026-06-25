import type { AsyncDatabase } from "./db/index.js";

export async function seedFoundation(db: AsyncDatabase): Promise<void> {
  const now = "2026-06-02T00:00:00.000Z";
  const projectCount = Number((await db.prepare(`SELECT COUNT(*) AS count FROM projects`).get())?.count ?? 0);
  if (projectCount > 0) {
    return;
  }
  await db.prepare(`INSERT INTO projects (id, name, slug, status, default_locale, markets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run("proj-demo", "Demo Property", "demo-property", "active", "de-DE", JSON.stringify([{ country: "DE", language: "de", device: "desktop", searchEngine: "google" }]), now, now);
  await db.prepare(`INSERT INTO sites (id, project_id, scope_type, base_url, crawl_frequency, business_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("site-demo", "proj-demo", "domain", "https://example.com", "weekly", 80, now);
  await db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`).run("int-gsc-demo", "proj-demo", "gsc", "pending", "B", null, null, now, now);
  await db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`).run("int-ga4-demo", "proj-demo", "ga4", "pending", "A", null, null, now, now);
  await db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("job-source-map-refresh-demo", "proj-demo", "source_map_refresh", "queued", "proj-demo:source_map_refresh:demo-property", JSON.stringify({ subject: "demo-property" }), 0, now, now, now);
  await db.prepare(`INSERT INTO source_repos (id, project_id, repo_url, default_branch, created_at) VALUES (?, ?, ?, ?, ?)`).run("repo-demo", "proj-demo", "file://.", "main", now);
  await db.prepare(`INSERT INTO templates (id, source_repo_id, name, component, repo_path) VALUES (?, ?, ?, ?, ?)`).run("tpl-home-demo", "repo-demo", "home-page", "HomePage", "apps/web/app/page.tsx");
  await db.prepare(`INSERT INTO url_template_map (id, project_id, url_pattern, template_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run("srcmap-home-demo", "proj-demo", "/", "tpl-home-demo", "exact", now);
  await db.prepare(`INSERT INTO feature_flags (key, enabled, description) VALUES (?, ?, ?)`).run("auth.email_password", 1, "Enable local backend-owned email/password sessions.");

  // UX7-W1 Content Workspace demo data: a small, deterministic clicks time-series so the refresh
  // board has decay signals out of the box. Tagged source_confidence='demo' — these are STUBS,
  // not measured data; real GSC clicks will replace them via the connector contract.
  const metricSeed: Array<{ url: string; values: [number, number, number] }> = [
    { url: "https://example.com/blog/seo-guide", values: [820, 540, 310] },  // steep decay -> top candidate
    { url: "https://example.com/blog/keyword-research", values: [200, 180, 140] }, // mild decay
    { url: "https://example.com/pricing", values: [400, 420, 450] }  // growing -> not a candidate
  ];
  const captures = ["2026-04-02T00:00:00.000Z", "2026-05-02T00:00:00.000Z", "2026-06-02T00:00:00.000Z"];
  let seq = 0;
  for (const entry of metricSeed) {
    for (let i = 0; i < captures.length; i += 1) {
      seq += 1;
      await db.prepare(`INSERT INTO page_metrics (id, project_id, site_id, url, metric, value, captured_at, source_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`pm-demo-${seq}`, "proj-demo", "site-demo", entry.url, "clicks", entry.values[i], captures[i], "demo");
    }
  }
}
