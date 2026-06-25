-- UX7-W1 Content Workspace backend (refresh-centric). Two tables:
--   content_recommendations: the editable, MANUAL content brief (no LLM auto-generation).
--     Linkable to an opportunity for board drill-down. JSON columns hold the editable lists.
--   page_metrics: a deterministic, demo-tagged stub time-series used to detect decay and rank
--     refresh candidates. Real GSC data flows in later via the connector contract; until then
--     source_confidence is 'demo'.
-- Idempotent (IF NOT EXISTS) so re-running the migration set is safe.

CREATE TABLE IF NOT EXISTS content_recommendations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  target_topic TEXT NOT NULL DEFAULT '',
  target_queries TEXT NOT NULL DEFAULT '[]',
  intent TEXT NOT NULL DEFAULT 'informational'
    CHECK (intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  sections TEXT NOT NULL DEFAULT '[]',
  terms TEXT NOT NULL DEFAULT '[]',
  internal_links TEXT NOT NULL DEFAULT '[]',
  validation_metric TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'in_progress', 'done', 'dismissed')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_recommendations_project ON content_recommendations(project_id, site_id, status);
CREATE INDEX IF NOT EXISTS idx_content_recommendations_url ON content_recommendations(project_id, site_id, url);
CREATE INDEX IF NOT EXISTS idx_content_recommendations_opportunity ON content_recommendations(opportunity_id);

CREATE TABLE IF NOT EXISTS page_metrics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('clicks', 'impressions', 'position', 'ctr')),
  value DOUBLE PRECISION NOT NULL,
  captured_at TEXT NOT NULL,
  -- 'demo' marks deterministic stub data; real connectors will write measured confidences.
  source_confidence TEXT NOT NULL DEFAULT 'demo',
  UNIQUE (project_id, site_id, url, metric, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_page_metrics_url ON page_metrics(project_id, site_id, url);
CREATE INDEX IF NOT EXISTS idx_page_metrics_metric ON page_metrics(project_id, site_id, url, metric, captured_at);
