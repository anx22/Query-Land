-- WP-2.2: Rank- & SERP-Tracking (Modul 3). SERP-Snapshots (Top-Ergebnisse, Features,
-- eigene Position) und Rank-Snapshots (eigene Position je Keyword/Markt/Device).
CREATE TABLE IF NOT EXISTS serp_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  market TEXT NOT NULL,
  device TEXT NOT NULL CHECK (device IN ('desktop', 'mobile')),
  captured_at TEXT NOT NULL,
  results TEXT NOT NULL DEFAULT '[]',
  serp_features TEXT NOT NULL DEFAULT '[]',
  own_position INTEGER,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E'))
);

CREATE INDEX IF NOT EXISTS idx_serp_snapshots_keyword ON serp_snapshots (keyword_id, captured_at);

CREATE TABLE IF NOT EXISTS rank_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  serp_snapshot_id TEXT REFERENCES serp_snapshots(id) ON DELETE SET NULL,
  market TEXT NOT NULL,
  device TEXT NOT NULL CHECK (device IN ('desktop', 'mobile')),
  position INTEGER,
  url TEXT,
  captured_at TEXT NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E'))
);

CREATE INDEX IF NOT EXISTS idx_rank_snapshots_keyword ON rank_snapshots (keyword_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_rank_snapshots_project_market ON rank_snapshots (project_id, market, captured_at);
