-- WP-2.3: Visibility-Index (Modul 3, §8). Projektspezifischer Sichtbarkeitsverlauf
-- auf dem eigenen Keyword-Set.
CREATE TABLE IF NOT EXISTS visibility_scores (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  market TEXT NOT NULL,
  score INTEGER NOT NULL,
  tracked_keywords INTEGER NOT NULL,
  average_position REAL,
  computed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visibility_scores_project_market ON visibility_scores (project_id, market, computed_at);
