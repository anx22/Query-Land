-- WP-2.1: Keyword Core (Modul 3). Kuratiertes Keyword-Universum mit Gruppen/Clustern,
-- Intent-, Brand- und Funnel-Klassifikation und URL-Mapping (DACH-Fokus, DEC-003).
CREATE TABLE IF NOT EXISTS keyword_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES keyword_groups(id) ON DELETE SET NULL,
  phrase TEXT NOT NULL,
  normalized_phrase TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('informational', 'commercial', 'transactional', 'navigational', 'local', 'comparison', 'problem_solving')),
  brand INTEGER NOT NULL DEFAULT 0 CHECK (brand IN (0, 1)),
  funnel_stage TEXT NOT NULL CHECK (funnel_stage IN ('awareness', 'consideration', 'decision', 'retention')),
  market TEXT NOT NULL DEFAULT 'DE',
  target_url TEXT,
  source TEXT NOT NULL CHECK (source IN ('gsc', 'manual', 'competitor', 'serp')),
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, normalized_phrase, market)
);

CREATE INDEX IF NOT EXISTS idx_keywords_project_group ON keywords (project_id, group_id);
CREATE INDEX IF NOT EXISTS idx_keywords_project_intent ON keywords (project_id, intent);
