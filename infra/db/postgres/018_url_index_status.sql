-- URL index coverage from the Google Search Console URL Inspection API (Technical Audit "indexed"
-- funnel stage). One row per (site, url); re-inspection upserts. `indexed` = Google's PASS verdict.
CREATE TABLE IF NOT EXISTS url_index_status (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  verdict         TEXT,
  coverage_state  TEXT,
  indexed         INTEGER NOT NULL DEFAULT 0,
  last_crawl_time TEXT,
  inspected_at    TEXT NOT NULL,
  UNIQUE (site_id, url)
);

CREATE INDEX IF NOT EXISTS idx_url_index_status_project_site ON url_index_status(project_id, site_id);
