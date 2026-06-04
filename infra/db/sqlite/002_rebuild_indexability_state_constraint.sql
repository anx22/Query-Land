CREATE TABLE IF NOT EXISTS url_indexability_assessments_next (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  discovered_url_id TEXT NOT NULL REFERENCES discovered_urls(id) ON DELETE CASCADE,
  fetch_result_id TEXT REFERENCES url_fetch_results(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('indexable', 'blocked_by_status', 'blocked_by_meta', 'blocked_by_x_robots', 'blocked_by_robots', 'canonicalized')),
  is_indexable INTEGER NOT NULL CHECK (is_indexable IN (0, 1)),
  reasons TEXT NOT NULL DEFAULT '[]',
  canonical_url TEXT,
  assessed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO url_indexability_assessments_next (
  id,
  project_id,
  site_id,
  discovered_url_id,
  fetch_result_id,
  url,
  state,
  is_indexable,
  reasons,
  canonical_url,
  assessed_at,
  created_at
)
SELECT
  id,
  project_id,
  site_id,
  discovered_url_id,
  fetch_result_id,
  url,
  state,
  is_indexable,
  reasons,
  canonical_url,
  assessed_at,
  created_at
FROM url_indexability_assessments;

DROP TABLE url_indexability_assessments;
ALTER TABLE url_indexability_assessments_next RENAME TO url_indexability_assessments;
CREATE INDEX IF NOT EXISTS idx_url_indexability_discovered_url ON url_indexability_assessments(discovered_url_id, assessed_at DESC);
