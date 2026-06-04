import type { SQLiteDatabase } from "./stores/sqlite-types.js";

export function seedFoundation(db: SQLiteDatabase): void {
  const now = "2026-06-02T00:00:00.000Z";
  const projectCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM projects`).get()?.count ?? 0);
  if (projectCount > 0) {
    return;
  }
  db.prepare(`INSERT INTO projects (id, name, slug, status, default_locale, markets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run("proj-demo", "Demo Property", "demo-property", "active", "de-DE", JSON.stringify([{ country: "DE", language: "de", device: "desktop", searchEngine: "google" }]), now, now);
  db.prepare(`INSERT INTO sites (id, project_id, scope_type, base_url, crawl_frequency, business_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("site-demo", "proj-demo", "domain", "https://example.com", "weekly", 80, now);
  db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`).run("int-gsc-demo", "proj-demo", "gsc", "pending", "B", null, null, now, now);
  db.prepare(`INSERT INTO integration_accounts (id, project_id, provider, status, source_confidence, auth_config, quota_remaining, freshness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)`).run("int-ga4-demo", "proj-demo", "ga4", "pending", "A", null, null, now, now);
  db.prepare(`INSERT INTO job_queue (id, project_id, job_type, status, idempotency_key, payload, attempts, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("job-source-map-refresh-demo", "proj-demo", "source_map_refresh", "queued", "proj-demo:source_map_refresh:demo-property", JSON.stringify({ subject: "demo-property" }), 0, now, now, now);
  db.prepare(`INSERT INTO source_repos (id, project_id, repo_url, default_branch, created_at) VALUES (?, ?, ?, ?, ?)`).run("repo-demo", "proj-demo", "file://.", "main", now);
  db.prepare(`INSERT INTO templates (id, source_repo_id, name, component, repo_path) VALUES (?, ?, ?, ?, ?)`).run("tpl-home-demo", "repo-demo", "home-page", "HomePage", "apps/web/app/page.tsx");
  db.prepare(`INSERT INTO url_template_map (id, project_id, url_pattern, template_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run("srcmap-home-demo", "proj-demo", "/", "tpl-home-demo", "exact", now);
  db.prepare(`INSERT INTO feature_flags (key, enabled, description) VALUES (?, ?, ?)`).run("auth.email_password", 1, "Enable local backend-owned email/password sessions.");
}
