-- WP-3.3: Source-Map Pre-Merge-Gate (§4.3 — der Differenzierer). Ein PR-Check löst geänderte
-- Repo-Pfade über die Source Map auf betroffene Templates/URL-Muster auf und verknüpft offene
-- Opportunities. Ergebnis wird zur Nachvollziehbarkeit persistiert (Verlauf je Projekt).
CREATE TABLE IF NOT EXISTS pr_checks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pr_number INTEGER,
  head_sha TEXT,
  changed_paths TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('passed', 'review_required', 'unmapped')),
  affected_templates TEXT NOT NULL DEFAULT '[]',
  affected_url_patterns TEXT NOT NULL DEFAULT '[]',
  related_opportunity_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pr_checks_project ON pr_checks (project_id, created_at);
